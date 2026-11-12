import 'dotenv/config';
import app from './app.js';

if (!process.env.JWT_SECRET) {
  console.error('Thiếu JWT_SECRET trong file backend/.env');
  process.exit(1);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend chạy tại http://localhost:${port}`);
});