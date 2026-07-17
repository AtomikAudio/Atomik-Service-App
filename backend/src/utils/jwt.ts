import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  role: string;
  tv: number;
}

export const generateToken = (payload: {
  id: string;
  role: string;
  tokenVersion?: number;
}): string => {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '365d';
  const body: JwtPayload = {
    id: payload.id,
    role: payload.role,
    tv: payload.tokenVersion ?? 0,
  };
  return jwt.sign(body, secret, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};
