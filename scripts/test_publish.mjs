import { supabase } from './src/lib/supabase.js';
import { createPost } from './src/services/supabaseService.js';
import fetch from 'node-fetch';

// We need to polyfill fetch for Supabase if not in browser, but node 18+ has fetch.
// Let's just run a direct test.
