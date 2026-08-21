const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
    const email = 'rizwan@wwrqatar.com';
    const password = 'WWW@123';

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !user) {
        console.error('User not found in Supabase!', error);
        process.exit(1);
    }

    console.log('User found in DB:', user);

    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password bcrypt comparison result:', isValid);

    const passwordChangedAt = user.passwords_changed_at ? new Date(user.passwords_changed_at) : new Date(0);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const isPasswordExpired = passwordChangedAt < ninetyDaysAgo;
    console.log('Is password expired (> 90 days):', isPasswordExpired);

    if (isValid && !isPasswordExpired) {
        console.log('✅ LOGIN VERIFICATION SUCCESSFUL!');
    } else {
        console.error('❌ LOGIN VERIFICATION FAILED!');
        process.exit(1);
    }
}

verify();
