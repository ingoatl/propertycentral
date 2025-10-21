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

interface NewBugEmailProps {
  bugTitle: string;
  priority: string;
  description: string;
  submittedBy: string;
  submittedEmail: string;
  submittedAt: string;
  loomVideoUrl?: string;
  propertyName?: string;
  projectAddress?: string;
  taskTitle?: string;
}

export const NewBugEmail = ({
  bugTitle,
  priority,
  description,
  submittedBy,
  submittedEmail,
  submittedAt,
  loomVideoUrl,
  propertyName,
  projectAddress,
  taskTitle,
}: NewBugEmailProps) => {
  const priorityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#f59e0b',
    low: '#84cc16',
  };
  
  const priorityEmojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const priorityColor = priorityColors[priority as keyof typeof priorityColors] || '#6b7280';
  const priorityEmoji = priorityEmojis[priority as keyof typeof priorityEmojis] || '🔵';

  return (
    <Html>
      <Head />
      <Preview>New bug report: {bugTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🐛 New Bug Report</Heading>
          
          <Section style={bugSection}>
            <Text style={bugTitle}>
              {priorityEmoji} {bugTitle}
            </Text>
            <Text style={priorityBadge}>
              <span style={{ ...badge, backgroundColor: priorityColor }}>
                {priority.toUpperCase()} PRIORITY
              </span>
            </Text>
          </Section>

          <Section style={infoSection}>
            <Text style={label}>Submitted by:</Text>
            <Text style={value}>{submittedBy} ({submittedEmail})</Text>
            
            <Text style={label}>Date:</Text>
            <Text style={value}>{submittedAt}</Text>
          </Section>

          {(propertyName || projectAddress || taskTitle) && (
            <Section style={contextSection}>
              <Text style={label}>Context:</Text>
              {propertyName && <Text style={value}>Property: {propertyName}</Text>}
              {projectAddress && <Text style={value}>Project: {projectAddress}</Text>}
              {taskTitle && <Text style={value}>Task: {taskTitle}</Text>}
            </Section>
          )}

          <Section style={descriptionSection}>
            <Text style={label}>Description:</Text>
            <div style={descriptionBox}>
              <Text style={descriptionText}>{description}</Text>
            </div>
          </Section>

          {loomVideoUrl && (
            <Section style={videoSection}>
              <Text style={label}>Video Documentation:</Text>
              <Link href={loomVideoUrl} style={videoLink}>
                🎥 View Loom Video →
              </Link>
            </Section>
          )}

          <Section style={actionSection}>
            <Link href="https://app.peachhausgroup.com/admin" style={button}>
              View in Bug Tracker
            </Link>
          </Section>

          <Text style={footer}>
            This is an automated notification from PeachHaus Group bug tracking system.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default NewBugEmail;

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

const bugSection = {
  padding: '0 40px',
  marginBottom: '24px',
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #dc2626',
  paddingTop: '16px',
  paddingBottom: '16px',
};

const bugTitle = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 12px',
};

const priorityBadge = {
  margin: '0',
};

const badge = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#ffffff',
  letterSpacing: '0.5px',
};

const infoSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const contextSection = {
  padding: '0 40px',
  marginBottom: '24px',
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #16a34a',
  paddingTop: '16px',
  paddingBottom: '16px',
};

const descriptionSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const descriptionBox = {
  backgroundColor: '#f9fafb',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
};

const descriptionText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const videoSection = {
  padding: '0 40px',
  marginBottom: '24px',
};

const videoLink = {
  color: '#2563eb',
  fontSize: '16px',
  textDecoration: 'none',
  fontWeight: '600',
};

const actionSection = {
  padding: '0 40px',
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 24px',
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

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 40px',
  marginTop: '32px',
};
