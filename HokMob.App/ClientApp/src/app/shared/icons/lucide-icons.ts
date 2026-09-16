import {MatIconRegistry} from "@angular/material/icon";
import {DomSanitizer} from "@angular/platform-browser";

/*
 * Icons from Lucide (https://lucide.dev), lucide-static v1.46.0.
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/** The namespace the icons are registered in: `<mat-icon svgIcon="lucide:newspaper">`. */
export const LUCIDE_ICON_NAMESPACE = "lucide";

/** Wraps an icon's shapes in Lucide's outline `<svg>` (24×24, stroked with the text color). */
function lucideSvg(shapes: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}

/** The Lucide icons the app uses, by Lucide name. Copy new ones from https://lucide.dev/icons. */
export const LUCIDE_ICONS: Record<string, string> = {
  "calendar-days": lucideSvg(
    '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>' +
    '<path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/>' +
    '<path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>'),
  "list-ordered": lucideSvg(
    '<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/>' +
    '<path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>'),
  "chart-no-axes-column": lucideSvg(
    '<path d="M5 21v-6"/><path d="M12 21V3"/><path d="M19 21V9"/>'),
  "clipboard-list": lucideSvg(
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
    '<path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  "newspaper": lucideSvg(
    '<path d="M15 18h-5"/><path d="M18 14h-8"/>' +
    '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/>' +
    '<rect width="8" height="4" x="10" y="6" rx="1"/>'),
  "shield": lucideSvg(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 ' +
    '6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
};

/**
 * Registers every icon in {@link LUCIDE_ICONS} with Angular Material under the "lucide" namespace. The SVGs are
 * inline, so nothing is fetched. `AppComponent` calls it once at startup, so every page can use the icons.
 */
export function registerLucideIcons(registry: MatIconRegistry, sanitizer: DomSanitizer): void {
  for (const [name, svg] of Object.entries(LUCIDE_ICONS)) {
    registry.addSvgIconLiteralInNamespace(LUCIDE_ICON_NAMESPACE, name, sanitizer.bypassSecurityTrustHtml(svg));
  }
}
