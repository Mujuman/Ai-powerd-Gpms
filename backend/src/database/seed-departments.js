import { randomUUID } from 'node:crypto'
import { pool } from './pool.js'

export const defaultDepartments = Object.freeze([
  { code: 'MED', name: 'Medicine' },
  { code: 'PHR', name: 'Pharmacy' },
  { code: 'NUR', name: 'Nursing' },
  { code: 'ANES', name: 'Anesthesia' },
  { code: 'MIDW', name: 'Midwifery' },
  { code: 'PH', name: 'Public Health' },
  { code: 'MLS', name: 'Medical Laboratory Science' },
  { code: 'CS', name: 'Computer Science' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'IS', name: 'Information Systems' },
  { code: 'ECE', name: 'Electrical and Computer Engineering' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'WSEE', name: 'Water Supply and Environmental Engineering' },
  { code: 'AF', name: 'Accounting and Finance' },
  { code: 'ECON', name: 'Economics' },
  { code: 'MGT', name: 'Management' },
  { code: 'MM', name: 'Marketing Management' },
  { code: 'PADM', name: 'Public Administration and Development Management' },
  { code: 'THM', name: 'Tourism and Hotel Management' },
  { code: 'AGE', name: 'Agricultural Economics' },
  { code: 'ANS', name: 'Animal Science' },
  { code: 'PLS', name: 'Plant Science' },
  { code: 'HORT', name: 'Horticulture' },
  { code: 'NRM', name: 'Natural Resources Management' },
  { code: 'RDAE', name: 'Rural Development and Agricultural Extension' },
  { code: 'SRWM', name: 'Soil Resource and Watershed Management' },
  { code: 'FSSD', name: 'Forestry and Saemaul Sustainable Development' },
  { code: 'SOC', name: 'Sociology' },
  { code: 'PSIR', name: 'Political Science and International Relations' },
  { code: 'CEES', name: 'Civics and Ethical Education / Studies' },
  { code: 'GES', name: 'Geography and Environmental Studies' },
  { code: 'HHM', name: 'History and Heritage Management' },
  { code: 'SA', name: 'Social Anthropology' },
  { code: 'ELL', name: 'English Language and Literature' },
  { code: 'ALL', name: 'Amharic Language and Literature' },
  { code: 'SLLC', name: 'Siltigna Language, Literature and Communication' },
  { code: 'JC', name: 'Journalism and Communication' },
  { code: 'ALC', name: 'Arabic Language and Communication' },
  { code: 'PSY', name: 'Psychology' },
  { code: 'EPM', name: 'Educational Planning and Management' },
  { code: 'TECS', name: 'Teacher Education and Curriculum Studies' },
])

function normalizeDepartmentName(name) {
  return String(name).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function nextAvailableCode(baseCode, usedCodes) {
  let code = baseCode
  let suffix = 2
  while (usedCodes.has(code.toLocaleUpperCase('en-US'))) {
    const suffixText = `_${suffix}`
    code = `${baseCode.slice(0, 32 - suffixText.length)}${suffixText}`
    suffix += 1
  }
  return code
}

export async function seedDepartments(databasePool = pool) {
  const [existingRows] = await databasePool.execute(
    'SELECT code, name FROM departments',
  )
  const existingNames = new Set(existingRows.map(({ name }) => normalizeDepartmentName(name)))
  const usedCodes = new Set(existingRows.map(({ code }) => code.toLocaleUpperCase('en-US')))
  const missing = []

  for (const department of defaultDepartments) {
    const normalizedName = normalizeDepartmentName(department.name)
    if (existingNames.has(normalizedName)) continue

    const code = nextAvailableCode(department.code, usedCodes)
    usedCodes.add(code.toLocaleUpperCase('en-US'))
    existingNames.add(normalizedName)
    missing.push([randomUUID(), code, department.name, true])
  }

  if (missing.length === 0) return 0

  await databasePool.query(
    `INSERT INTO departments (id, code, name, is_active)
     VALUES ?
     ON DUPLICATE KEY UPDATE id = id`,
    [missing],
  )
  return missing.length
}
