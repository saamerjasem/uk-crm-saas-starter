export const metadata = { title: 'UK CRM' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  )
}
