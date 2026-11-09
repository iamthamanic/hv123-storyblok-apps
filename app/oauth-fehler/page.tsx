import Link from "next/link";

export default function OauthErrorPage() {
  return (
    <main className="seitencheck-app">
      <div className="sc-workspace">
        <h1 className="sc-h1">Anmeldung abgebrochen</h1>
        <p className="sc-sub">Storyblok hat den Zugriff nicht abgeschlossen. Die App erneut aus dem Space öffnen oder APP_URL, Client-ID und Callback prüfen.</p>
        <Link className="sc-btn" href="/">Zur Übersicht</Link>
      </div>
    </main>
  );
}
