import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto card p-8 text-center space-y-4">
      <h1 className="text-3xl text-nile">Page not found</h1>
      <Link href="/" className="btn btn-primary">Back to listings</Link>
    </div>
  );
}
