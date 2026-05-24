import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function enrichAddress() {
    const { data: attractions, error } = await supabase.from('attractions').select('id, name, city, province, address');
    if (error) {
        console.error("Error fetching attractions:", error);
        return;
    }

    console.log(`Found ${attractions.length} attractions to fix address...`);
    let updated = 0;
    
    for (const attr of attractions) {
        const query = encodeURIComponent(`${attr.province}${attr.city}${attr.name}`);
        const url = `https://apis.map.qq.com/ws/geocoder/v1/?address=${query}&key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77`;
        
        try {
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.status === 0 && json.result && json.result.address_components) {
                const comps = json.result.address_components;
                let formattedAddress = `${comps.province} · ${comps.city}`;
                if (comps.district && comps.district !== comps.city && !comps.city.includes(comps.district)) {
                    formattedAddress += ` · ${comps.district}`;
                }
                
                await supabase.from('attractions').update({
                    address: formattedAddress
                }).eq('id', attr.id);
                
                console.log(`[${updated + 1}/${attractions.length}] Updated ${attr.name} -> ${formattedAddress}`);
                updated++;
            } else {
                console.log(`[!] Failed to geocode ${attr.name}: ${json.message}`);
            }
        } catch (e) {
            console.error(`[!] Error on ${attr.name}:`, e.message);
        }
        
        await sleep(100); // 10 QPS limit
    }
    
    console.log(`Finished! Updated ${updated} attractions.`);
}

enrichAddress();
