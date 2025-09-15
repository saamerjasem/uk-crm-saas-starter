export default function Home() {
  return (
    <main>
      <h1>UK CRM, multi-tenant starter</h1>
      <p>Use the API endpoints to create contacts and deals. Add a domain for your tenant, then call the API on that host.</p>
      <ul>
        <li>POST /api/contacts, JSON { first_name, last_name, email }</li>
        <li>GET /api/contacts</li>
        <li>POST /api/deals, JSON { title, value }</li>
        <li>GET /api/deals</li>
      </ul>
    </main>
  )
}
