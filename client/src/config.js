const config = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000/',
  environment: process.env.REACT_APP_ENVIRONMENT || 'development',
  publicUrl: process.env.REACT_APP_PUBLIC_URL || '/'
};
  
console.log('Config:', config);

export default config;