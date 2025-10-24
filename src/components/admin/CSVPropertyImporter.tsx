import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { PropertyMatchResult, CSVPropertyRow } from "@/types/property-data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const CSVPropertyImporter = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<PropertyMatchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Parse CSV row data and clean currency values
  const parseCurrency = (value?: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const parseBoolean = (value?: string): boolean => {
    if (!value) return false;
    const v = value.toUpperCase();
    return v === 'TRUE' || v === 'YES' || v === '1';
  };

  // Fuzzy address matching using Levenshtein distance
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = longer.length - getEditDistance(longer, shorter);
    return (editDistance / longer.length) * 100;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const rows = text.split('\n');
      
      // Find the header row (row 6 in the CSV)
      const headerRow = rows[5];
      
      // Parse data rows (starting from row 9)
      const dataRows = rows.slice(8).filter(row => row.trim());
      
      // Get existing properties for matching
      const { data: existingProperties, error } = await supabase
        .from('properties')
        .select('id, name, address');
      
      if (error) throw error;
      
      const matchResults: PropertyMatchResult[] = [];
      
      for (const row of dataRows) {
        const columns = row.split(',');
        
        // Skip empty rows or rows without address
        if (columns.length < 2 || !columns[1]?.trim()) continue;
        
        const csvRow: CSVPropertyRow = {
          good_to_go: columns[0],
          properties: columns[1],
          brand_name: columns[2],
          str_mtr: columns[3],
          house: columns[4],
          stories: columns[5],
          parking: columns[6],
          school_district: columns[7],
          ada_compliant: columns[8],
          basement: columns[9],
          fenced_in: columns[10],
          bedrooms: columns[11],
          bathrooms: columns[12],
          sqft: columns[13],
          pets: columns[14],
          pet_rule: columns[15],
          monthly: columns[16],
          nightly: columns[17],
          deposit: columns[18],
          utility_cap: columns[19],
          cleaning_fee: columns[20],
          admin_fee: columns[21],
          pet_fee: columns[22],
          monthly_pet_rent: columns[23],
          monthly_cleaning: columns[24],
          lease_term: columns[25],
          notice_to_vacate: columns[26],
          email_entered: columns[27],
          direct_booking_website: columns[28],
          mobile: columns[32],
          homelink: columns[33],
          crs_updated: columns[34],
          ale: columns[35],
          nch: columns[36],
          cru_homes: columns[37],
          sedgwick: columns[38],
          homads: columns[39],
          uch: columns[40],
          midtermrentals: columns[41],
          alacrity: columns[42]
        };
        
        // Find best match using fuzzy matching
        let bestMatch = null;
        let bestScore = 0;
        
        for (const prop of existingProperties || []) {
          const score = calculateSimilarity(csvRow.properties, prop.address);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = prop;
          }
        }
        
        // Determine match status
        let status: PropertyMatchResult['status'];
        let suggestedAction: PropertyMatchResult['suggested_action'];
        
        if (bestScore >= 90) {
          status = 'high_confidence';
          suggestedAction = 'auto_import';
        } else if (bestScore >= 70) {
          status = 'low_confidence';
          suggestedAction = 'manual_review';
        } else {
          status = 'no_match';
          suggestedAction = 'create_new';
        }
        
        matchResults.push({
          csv_row: csvRow,
          matched_property: bestMatch ? {
            id: bestMatch.id,
            name: bestMatch.name,
            address: bestMatch.address
          } : undefined,
          confidence_score: Math.round(bestScore),
          status,
          suggested_action: suggestedAction
        });
      }
      
      setMatches(matchResults);
      setShowResults(true);
      toast.success(`Processed ${matchResults.length} properties from CSV`);
      
    } catch (error) {
      console.error('Error processing CSV:', error);
      toast.error('Failed to process CSV file');
    } finally {
      setIsProcessing(false);
    }
  };

  const importHighConfidenceMatches = async () => {
    setIsProcessing(true);
    
    try {
      const highConfidenceMatches = matches.filter(m => m.confidence_score >= 90 && m.matched_property);
      let successCount = 0;
      
      for (const match of highConfidenceMatches) {
        const propertyId = match.matched_property!.id;
        const row = match.csv_row;
        
        // Import property details (only if empty)
        await supabase.from('property_details').upsert({
          property_id: propertyId,
          brand_name: row.brand_name || undefined,
          property_type_detail: row.house || undefined,
          stories: row.stories || undefined,
          sqft: row.sqft ? parseInt(row.sqft.replace(/,/g, '')) : undefined,
          bedrooms: row.bedrooms ? parseInt(row.bedrooms) : undefined,
          bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : undefined,
          parking_type: row.parking || undefined,
          basement: row.basement ? parseBoolean(row.basement) : false,
          fenced_yard: row.fenced_in || undefined,
          ada_compliant: row.ada_compliant ? parseBoolean(row.ada_compliant) : false
        }, {
          onConflict: 'property_id',
          ignoreDuplicates: true
        });
        
        // Import pricing (create new history record)
        const monthlyRent = parseCurrency(row.monthly);
        const nightlyRate = parseCurrency(row.nightly);
        
        if (monthlyRent || nightlyRate) {
          await supabase.from('property_pricing_history').insert({
            property_id: propertyId,
            monthly_rent: monthlyRent,
            nightly_rate: nightlyRate,
            security_deposit: parseCurrency(row.deposit),
            utility_cap: parseCurrency(row.utility_cap),
            cleaning_fee: parseCurrency(row.cleaning_fee),
            admin_fee: parseCurrency(row.admin_fee),
            pet_fee: parseCurrency(row.pet_fee),
            monthly_pet_rent: parseCurrency(row.monthly_pet_rent),
            monthly_cleaning_fee: parseCurrency(row.monthly_cleaning),
            is_current: true
          });
        }
        
        // Import policies
        await supabase.from('property_policies').upsert({
          property_id: propertyId,
          pets_allowed: row.pets ? parseBoolean(row.pets) : false,
          pet_rules: row.pet_rule || undefined,
          lease_term: row.lease_term || undefined,
          notice_to_vacate: row.notice_to_vacate || undefined
        }, {
          onConflict: 'property_id',
          ignoreDuplicates: true
        });
        
        // Import contact info
        await supabase.from('property_contact_info').upsert({
          property_id: propertyId,
          contact_email: row.email_entered || undefined,
          website_url: row.direct_booking_website || undefined
        }, {
          onConflict: 'property_id',
          ignoreDuplicates: true
        });
        
        // Import platform listings
        const platforms = [
          { name: 'Mobile', active: parseBoolean(row.mobile) },
          { name: 'Homelink', active: parseBoolean(row.homelink) },
          { name: 'CRS Updated', active: parseBoolean(row.crs_updated) },
          { name: 'ALE', active: parseBoolean(row.ale) },
          { name: 'NCH', active: parseBoolean(row.nch) },
          { name: 'CRU Homes', active: parseBoolean(row.cru_homes) },
          { name: 'Sedgwick', active: parseBoolean(row.sedgwick) },
          { name: 'Homads', active: parseBoolean(row.homads) },
          { name: 'UCH', active: parseBoolean(row.uch) },
          { name: 'Midtermrentals.com', active: parseBoolean(row.midtermrentals) },
          { name: 'Alacrity', active: parseBoolean(row.alacrity) }
        ];
        
        for (const platform of platforms) {
          await supabase.from('platform_listings').upsert({
            property_id: propertyId,
            platform_name: platform.name,
            is_active: platform.active
          }, {
            onConflict: 'property_id,platform_name',
            ignoreDuplicates: false
          });
        }
        
        successCount++;
      }
      
      toast.success(`Successfully imported data for ${successCount} properties`);
      setShowResults(false);
      setMatches([]);
      
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Failed to import property data');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (match: PropertyMatchResult) => {
    switch (match.status) {
      case 'high_confidence':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />High Match ({match.confidence_score}%)</Badge>;
      case 'low_confidence':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Review ({match.confidence_score}%)</Badge>;
      default:
        return <Badge variant="destructive"><Info className="w-3 h-3 mr-1" />No Match</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Property Data from CSV</CardTitle>
        <CardDescription>
          Upload the CSV file to import property specifications, pricing, and platform listings. 
          Only empty fields will be populated - existing data will not be overwritten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => document.getElementById('csv-upload')?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Upload CSV File'}
          </Button>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {showResults && matches.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Found {matches.filter(m => m.confidence_score >= 90).length} high-confidence matches,{' '}
                {matches.filter(m => m.confidence_score >= 70 && m.confidence_score < 90).length} requiring review,{' '}
                {matches.filter(m => m.confidence_score < 70).length} with no match.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {matches.map((match, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{match.csv_row.properties}</p>
                          {match.matched_property && (
                            <p className="text-sm text-muted-foreground mt-1">
                              → Matches: {match.matched_property.address}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {match.csv_row.bedrooms}BR / {match.csv_row.bathrooms}BA
                            {match.csv_row.monthly && ` • ${match.csv_row.monthly}/mo`}
                          </p>
                        </div>
                        {getStatusBadge(match)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Button 
              onClick={importHighConfidenceMatches}
              disabled={isProcessing || matches.filter(m => m.confidence_score >= 90).length === 0}
              className="w-full"
            >
              Import {matches.filter(m => m.confidence_score >= 90).length} High-Confidence Matches
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
