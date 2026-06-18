import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function check() {
  console.log('Checking database students and classes...\n')

  // Count total classes
  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('class_name, grade, jurusan')
  
  if (classErr) console.error('Class error:', classErr.message)
  else console.log(`Total classes: ${classes.length}`, classes)

  // Count total students
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('nis, name, class_name, grade, status')
  
  if (studErr) {
    console.error('Student error:', studErr.message)
  } else {
    console.log(`Total students: ${students.length}`)
    const active = students.filter(s => s.status === 'AKTIF')
    const graduated = students.filter(s => s.status === 'LULUS')
    console.log(`- Active: ${active.length}`)
    console.log(`- Graduated: ${graduated.length}`)
    
    console.log('\nSample active students (first 5):')
    console.log(active.slice(0, 5))
  }
}

check()
