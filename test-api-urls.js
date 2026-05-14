// Test script to verify API URL construction
// Run this in the browser console on the frontend

console.log('Environment variables:');
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

// Import the API_BASE_URL from httpClient
import('./src/config/httpClient.js').then(module => {
  console.log('API_BASE_URL:', module.API_BASE_URL);
  
  // Test some example URLs
  const testUrls = [
    '/clients',
    '/clients/full-data',
    '/drafts',
    '/proposals'
  ];
  
  testUrls.forEach(path => {
    console.log(`${path} -> ${module.API_BASE_URL}${path}`);
  });
}).catch(err => {
  console.error('Failed to import httpClient:', err);
});
