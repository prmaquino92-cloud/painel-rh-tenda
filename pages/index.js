import { isAuthenticated } from '../lib/auth';

export default function Home() {
  return null;
}

export async function getServerSideProps(context) {
  if (isAuthenticated(context.req)) {
    return { redirect: { destination: '/app', permanent: false } };
  }
  return { redirect: { destination: '/login', permanent: false } };
}
