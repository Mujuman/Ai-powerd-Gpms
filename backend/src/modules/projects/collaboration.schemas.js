import { z } from 'zod'

export const titleRecommendationSchema = z.object({
  interest: z.string().trim().min(2).max(2000),
  area: z.string().trim().min(2).max(2000),
  tools: z.string().trim().min(2).max(2000),
}).strict()

export const projectMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
}).strict()

export const projectDocumentSchema = z.object({
  documentType: z.enum(['advisor_document', 'defense_correction']),
}).strict()
