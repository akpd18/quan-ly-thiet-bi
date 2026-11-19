// Lỗi có kèm mã trạng thái HTTP, dùng để dừng xử lý và trả lời người dùng
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendError(error, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

// Chạy các thao tác trong một giao dịch: cùng thành công hoặc cùng bị hủy
export async function withTransaction(pool, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}