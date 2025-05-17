"use client"
import './globalStyles.css';


// export const metadata: metadata = {
//   title: 'Graph Space',
//   description: '',
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body onContextMenu={(e) => e.preventDefault()}>
        {children}
        <div id="useFont">A</div>
      </body>
    </html>
  )
}
