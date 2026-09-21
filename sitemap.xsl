<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="s">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="ro">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, follow"/>
        <title>Sitemap – Laura Miron</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fbfcfe; color: #24272d; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          main { max-width: 60rem; margin: 0 auto; padding: 32px 24px 48px; }
          h1 { font-size: 1.6rem; margin: 0 0 8px; }
          p { line-height: 1.5; color: #586070; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; border: 1px solid #d4dce8; }
          th, td { text-align: left; padding: 10px 14px; border-top: 1px solid #d4dce8; font-size: .95rem; }
          thead th { border-top: 0; background: #eef2f9; }
          td:last-child { white-space: nowrap; }
          a { color: #1d3c8f; overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <main>
          <h1>Sitemap</h1>
          <p>Harta site-ului: toate paginile publice, în română și în engleză.</p>
          <p lang="en">Sitemap with all public pages, in Romanian and in English.</p>
          <p><xsl:value-of select="count(s:urlset/s:url)"/> adrese · URLs</p>
          <table>
            <thead>
              <tr><th>URL</th><th>Ultima modificare · Last modified</th></tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                  <td><xsl:value-of select="s:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
