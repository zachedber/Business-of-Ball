import './globals.css';

export const metadata = {
  title: 'Business of Ball — Sports Empire Sim',
  description: 'Build your sports empire across football and basketball leagues.',
  manifest: '/manifest.json',
  themeColor: '#1A1208',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Business of Ball" />
      </head>
      <body>{children}</body>
    </html>
  );
}
