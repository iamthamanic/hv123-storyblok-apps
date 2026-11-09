/**
 * Kleiner Client für die Storyblok Management API (EU: https://mapi.storyblok.com/v1).
 * Personal Access Token wird roh gesendet, OAuth-Token als Bearer.
 */

import { getManagementBaseUrl, type Region } from "@storyblok/region-helper";

export class StoryblokError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StoryblokError";
    this.status = status;
  }
}

export class StoryblokClient {
  constructor(
    private readonly token: string,
    readonly spaceId: string,
    private readonly region: Region,
    private readonly auth: "pat" | "oauth",
  ) {}

  baseUrl(): string {
    return `${getManagementBaseUrl(this.region)}/v1`;
  }

  async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl()}${pathname}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: this.auth === "oauth" ? `Bearer ${this.token}` : this.token,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { raw: text.slice(0, 500) };
      }
    }
    if (!response.ok) {
      const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const message = typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : response.statusText;
      throw new StoryblokError(message || "Storyblok-Anfrage fehlgeschlagen", response.status);
    }
    return body as T;
  }
}
