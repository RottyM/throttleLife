
import { redirect } from 'next/navigation';

// This is a server component that unconditionally redirects to the login page.
// The login page will then handle redirecting authenticated users to the dashboard.
export default function RootPage() {
  redirect('/login');

  // This component will never actually render anything because of the redirect.
  // A return statement is still required by React.
  return null;
}
