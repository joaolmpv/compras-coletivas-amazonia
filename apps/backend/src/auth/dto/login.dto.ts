import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;
