import './globals.css';

export const metadata = {
  title: 'Franchise Builder — Sports Empire Sim',
  description: 'Build your sports empire. Manage franchises across the NGL and ABL.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
