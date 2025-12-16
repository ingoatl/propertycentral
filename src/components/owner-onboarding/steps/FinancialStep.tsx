import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

interface FileUploadProps {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FileUpload({ label, required, file, onChange }: FileUploadProps) {
  return (
    <div>
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="mt-1">
        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[hsl(25,95%,65%)] hover:bg-[hsl(25,100%,98%)] transition-all">
          {file ? (
            <div className="flex items-center gap-2 text-green-600">
              <FileText className="w-5 h-5" />
              <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <Upload className="w-5 h-5" />
              <span className="text-sm">Click to upload</span>
            </div>
          )}
          <input
            type="file"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            accept=".pdf,.csv,.xls,.xlsx"
          />
        </label>
      </div>
    </div>
  );
}

export function FinancialStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Financial Performance</h2>
        <p className="text-gray-600">Share your property's historical and current revenue data.</p>
      </div>

      {/* Historical Revenue Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Historical Revenue Benchmark</h3>
        
        <div>
          <Label htmlFor="last_year_revenue" className="text-sm font-medium">
            Last Year's Total Revenue
          </Label>
          <Input
            id="last_year_revenue"
            type="number"
            value={formData.last_year_revenue}
            onChange={(e) => updateFormData({ last_year_revenue: e.target.value })}
            placeholder="50000"
            className="h-14 mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FileUpload
            label="Airbnb Revenue Export"
            file={formData.airbnb_revenue_export_file}
            onChange={(file) => updateFormData({ airbnb_revenue_export_file: file })}
          />

          <FileUpload
            label="VRBO Revenue Export"
            file={formData.vrbo_revenue_export_file}
            onChange={(file) => updateFormData({ vrbo_revenue_export_file: file })}
          />

          <FileUpload
            label="OwnerRez Revenue Export"
            file={formData.ownerrez_revenue_export_file}
            onChange={(file) => updateFormData({ ownerrez_revenue_export_file: file })}
          />
        </div>
      </div>

      {/* Current Revenue Performance Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Current Revenue Performance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="average_daily_rate" className="text-sm font-medium">
              Average Daily Rate (ADR) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="average_daily_rate"
              type="number"
              value={formData.average_daily_rate}
              onChange={(e) => updateFormData({ average_daily_rate: e.target.value })}
              placeholder="150"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="occupancy_rate" className="text-sm font-medium">
              Occupancy Rate (%) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="occupancy_rate"
              type="number"
              value={formData.occupancy_rate}
              onChange={(e) => updateFormData({ occupancy_rate: e.target.value })}
              placeholder="75"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="average_booking_window" className="text-sm font-medium">
              Average Booking Window (days)
            </Label>
            <Input
              id="average_booking_window"
              type="number"
              value={formData.average_booking_window}
              onChange={(e) => updateFormData({ average_booking_window: e.target.value })}
              placeholder="14"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="average_monthly_revenue" className="text-sm font-medium">
              Average Monthly Revenue <span className="text-red-500">*</span>
            </Label>
            <Input
              id="average_monthly_revenue"
              type="number"
              value={formData.average_monthly_revenue}
              onChange={(e) => updateFormData({ average_monthly_revenue: e.target.value })}
              placeholder="4000"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>

      {/* Seasonal Trends Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Seasonal Trends</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="peak_season" className="text-sm font-medium">Peak Season</Label>
            <Select
              value={formData.peak_season}
              onValueChange={(value) => updateFormData({ peak_season: value })}
            >
              <SelectTrigger className="h-14 mt-1">
                <SelectValue placeholder="Select peak season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Spring (Mar-May)">Spring (Mar-May)</SelectItem>
                <SelectItem value="Summer (Jun-Aug)">Summer (Jun-Aug)</SelectItem>
                <SelectItem value="Fall (Sep-Nov)">Fall (Sep-Nov)</SelectItem>
                <SelectItem value="Winter (Dec-Feb)">Winter (Dec-Feb)</SelectItem>
                <SelectItem value="Year-round">Year-round</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="peak_season_adr" className="text-sm font-medium">Peak Season ADR</Label>
            <Input
              id="peak_season_adr"
              type="number"
              value={formData.peak_season_adr}
              onChange={(e) => updateFormData({ peak_season_adr: e.target.value })}
              placeholder="200"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>

      {/* Financial Documentation Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Financial Documentation (Optional)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUpload
            label="Revenue Statement"
            file={formData.revenue_statement_file}
            onChange={(file) => updateFormData({ revenue_statement_file: file })}
          />

          <FileUpload
            label="Expense Report"
            file={formData.expense_report_file}
            onChange={(file) => updateFormData({ expense_report_file: file })}
          />
        </div>
      </div>

      {/* Market Insights Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Market Insights</h3>
        
        <div>
          <Label htmlFor="competitor_insights" className="text-sm font-medium">
            Competitor Insights
          </Label>
          <Textarea
            id="competitor_insights"
            value={formData.competitor_insights}
            onChange={(e) => updateFormData({ competitor_insights: e.target.value })}
            placeholder="Share any insights about competing properties in your area..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="pricing_revenue_goals" className="text-sm font-medium">
            Pricing & Revenue Goals <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.pricing_revenue_goals}
            onValueChange={(value) => updateFormData({ pricing_revenue_goals: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select your primary goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Maximize revenue">Maximize revenue</SelectItem>
              <SelectItem value="Maximize occupancy">Maximize occupancy</SelectItem>
              <SelectItem value="Balance both">Balance both</SelectItem>
              <SelectItem value="Premium pricing, fewer guests">Premium pricing, fewer guests</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
