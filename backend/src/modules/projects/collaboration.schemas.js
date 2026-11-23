import { z } from 'zod'

export const titleRecommendationSchema = z.object({
  projectIdea: z.string().trim().min(2).max(1000),
  problemStatement: z.string().trim().min(2).max(3000),
  generalObjective: z.string().trim().min(2).max(1000),
  specificObjectives: z.string().trim().min(2).max(3000),
  projectDescription: z.string().trim().min(2).max(5000),
  technologies: z.string().trim().min(2).max(1000),
  domain: z.string().trim().min(2).max(1000),
}).strict()

export const projectMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
}).strict()

export const projectDocumentSchema = z.object({
  documentType: z.enum(['advisor_document', 'defense_correction']),
}).strict()

export const correctionReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(4000).optional().default(''),
}).strict().refine((value) => value.decision !== 'rejected' || value.note.length > 0, {
  path: ['note'],
  message: 'A reason is required when requesting another correction',
})
