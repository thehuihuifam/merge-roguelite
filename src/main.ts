import { createApp } from '@/app/createApp';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('Missing #app root element');
}

const app = createApp(root);
app.start();
