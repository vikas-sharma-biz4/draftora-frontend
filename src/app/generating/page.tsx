"use client";

import { useRouter } from "next/navigation";

export default function GeneratingPage(): JSX.Element {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg border p-8 max-w-md w-full">
        <h1 className="text-lg font-semibold mb-4">Invalid URL</h1>
        <p className="text-gray-700 mb-6">
          Please provide a proposal ID to view the generation progress.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
