// Shared types and utilities for MightyOps packages

export type UUID = string;
export type ISODateString = string;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  detail: string;
  status: number;
}

// Core entity types
export interface Organization {
  id: UUID;
  name: string;
  plan: string;
  created_at: ISODateString;
}

export interface User {
  id: UUID;
  organization_id: UUID;
  email: string;
  name: string;
  role: "owner" | "manager" | "employee" | "agent";
  is_active: boolean;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Lead {
  id: UUID;
  organization_id: UUID;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: LeadStatus;
  score: number;
  source?: string;
  assigned_to?: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Deal {
  id: UUID;
  organization_id: UUID;
  title: string;
  value: number;
  currency: string;
  probability: number;
  stage: string;
  lead_id?: UUID;
  contact_id?: UUID;
  company_id?: UUID;
  closed_at?: ISODateString;
  created_at: ISODateString;
}

export interface Notification {
  id: UUID;
  user_id: UUID;
  title: string;
  body?: string;
  read: boolean;
  action_url?: string;
  created_at: ISODateString;
}

export interface ActionRun {
  id: UUID;
  organization_id: UUID;
  action_name: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error_message?: string;
  started_at?: ISODateString;
  completed_at?: ISODateString;
  created_at: ISODateString;
}

// Utility helpers
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function formatRelativeTime(iso: ISODateString): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}
