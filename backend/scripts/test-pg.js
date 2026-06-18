import 'dotenv/config'

const str1 = 'postgresql://postgres.plbxuqfaredrmpvnidwb:Sutrisno_123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
const str2 = process.env.DATABASE_URL

console.log('str1 length:', str1.length)
console.log('str2 length:', str2 ? str2.length : 'undefined')
console.log('Identical?', str1 === str2)
if (str2) {
  for (let i = 0; i < Math.max(str1.length, str2.length); i++) {
    if (str1[i] !== str2[i]) {
      console.log(`Mismatch at index ${i}: str1=${JSON.stringify(str1[i])}, str2=${JSON.stringify(str2[i])}`)
      break
    }
  }
}
