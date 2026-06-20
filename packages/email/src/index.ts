// Email campaign integration for MightyOps

export interface EmailContact {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface EmailMessage {
  to: EmailContact | EmailContact[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: EmailContact;
  replyTo?: string;
  tags?: string[];
}

export interface SendResult {
  provider: "sendgrid" | "smtp" | "log" | string;
  to: string;
  messageId?: string;
  statusCode?: number;
  error?: string;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

/**
 * EmailCampaignClient wraps the MightyOps API for campaign management.
 * Actual delivery is handled server-side via SendGrid or SMTP.
 */
export class EmailCampaignClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** List email campaigns for the authenticated org. */
  listCampaigns(params?: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.fetch<unknown[]>(`/campaigns${qs ? `?${qs}` : ""}`);
  }

  /** Create a new email campaign. */
  createCampaign(data: {
    name: string;
    subject: string;
    html_body: string;
    text_body?: string;
    from_email?: string;
    from_name?: string;
  }) {
    return this.fetch<{ id: string; name: string }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Send a campaign to a list of contacts. */
  sendCampaign(campaignId: string, contactIds: string[]) {
    return this.fetch<{ queued: number }>(`/campaigns/${campaignId}/send`, {
      method: "POST",
      body: JSON.stringify({ contact_ids: contactIds }),
    });
  }

  /** Get campaign performance stats. */
  getCampaignStats(campaignId: string) {
    return this.fetch<CampaignStats>(`/campaigns/${campaignId}/stats`);
  }

  /** Create an email template. */
  createTemplate(data: { name: string; subject: string; html_body: string; text_body?: string }) {
    return this.fetch<{ id: string }>("/email-templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** List email templates. */
  listTemplates() {
    return this.fetch<unknown[]>("/email-templates");
  }
}
