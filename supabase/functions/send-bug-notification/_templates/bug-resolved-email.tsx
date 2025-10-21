import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface BugResolvedEmailProps {
  bugTitle: string;
  description: string;
  resolutionNotes: string;
  resolvedBy: string;
  resolvedAt: string;
  userName: string;
}

export const BugResolvedEmail = ({
  bugTitle,
  description,
  resolutionNotes,
  resolvedBy,
  resolvedAt,
  userName,
}: BugResolvedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your bug report has been resolved: {bugTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>✅ Bug Resolved!</Heading>
          
          <Text style={greeting}>Hi {userName},</Text>
          
          <Text style={text}>
            Great news! The bug you reported has been resolved.
          </Text>

          <Section style={bugSection}>
            <Text style={bugTitle}>{bugTitle}</Text>
          </Section>

          <Section style={yourReportSection}>
            <Text style={label}>Your Report:</Text>
            <div style={contentBox}>
              <Text style={contentText}>{description}</Text>
            </div>
          </Section>

          <Section style={resolutionSection}>
            <Text style={label}>Resolution:</Text>
            <div style={resolutionBox}>
              <Text style={contentText}>{resolutionNotes}</Text>
            </div>
          </Section>

          <Section style={infoSection}>
            <Text style={label}>Resolved by:</Text>
            <Text style={value}>{resolvedBy}</Text>
            
            <Text style={label}>Resolution Date:</Text>
            <Text style={value}>{resolvedAt}</Text>
          </Section>

          <Text style={thankYou}>
            Thank you for helping us improve the platform! Your feedback helps us create a better experience for everyone.
          </Text>

          <Text style={signature}>
            Best regards,<br />
            The PeachHaus Team
          </Text>

          <Text style={footer}>
            If you have any questions about this resolution, please don't hesitate to reach out.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default BugResolvedEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0 40px',
};

const greeting = {
  color: '#1f2937',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 40px',
  margin: '0 0 16px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 40px',
  margin: '0 0 24px',
};

const bugSection = {
  padding: '0 40px',
  marginBottom: '24px',
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #16a34a',
  paddingTop: '16px',
  paddingBottom: '16px',
};

const bugTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0',
};

const yourReportSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const resolutionSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const contentBox = {
  backgroundColor: '#f9fafb',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
};

const resolutionBox = {
  backgroundColor: '#f0fdf4',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #bbf7d0',
};

const contentText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const infoSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const label = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
};

const value = {
  color: '#1f2937',
  fontSize: '14px',
  margin: '0 0 16px',
};

const thankYou = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 40px',
  margin: '32px 0 24px',
};

const signature = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 40px',
  margin: '0 0 32px',
};

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 40px',
  marginTop: '32px',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '32px',
};
