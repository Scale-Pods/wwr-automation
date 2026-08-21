const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        envVars[key] = value;
    }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    const email = 'info@scalepods.co';
    const plainPassword = 'ScalePods@123';
    const fullName = 'ScalePods Admin';

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(plainPassword, salt);

    console.log('Hashed Password:', passwordHash);

    const now = new Date().toISOString();

    // Check if user already exists
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    const userId = existingUser ? existingUser.id : crypto.randomUUID();

    const userData = {
        id: userId,
        email: email,
        password_hash: passwordHash,
        full_name: fullName,
        created_at: existingUser ? existingUser.created_at : now,
        passwords_changed_at: now,
        otp_code: null,
        otp_expires_at: null
    };

    let result;
    if (existingUser) {
        console.log('Updating existing user in public.users table...', userData);
        result = await supabase
            .from('users')
            .update(userData)
            .eq('id', userId)
            .select();
    } else {
        console.log('Inserting new user into public.users table...', userData);
        result = await supabase
            .from('users')
            .insert(userData)
            .select();
    }

    if (result.error) {
        console.error('Error inserting/updating user in Supabase:', result.error);
        process.exit(1);
    }

    console.log('Successfully inserted/updated user record:', JSON.stringify(result.data, null, 2));

    // Verify password comparison
    const isValid = await bcrypt.compare(plainPassword, passwordHash);
    console.log('Bcrypt comparison verification:', isValid);
}

run();
