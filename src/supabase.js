import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pxhbxewnijavotdwiueo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aGJ4ZXduaWphdm90ZHdpdWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjIwODIsImV4cCI6MjA4OTkzODA4Mn0.UD55F-XT43KYbZpKRiwuD70eSNLpJvAQT5n-V5bYL00'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
