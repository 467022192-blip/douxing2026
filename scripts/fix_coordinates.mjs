import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GCJ-02 to BD-09
const x_PI = 3.14159265358979324 * 3000.0 / 180.0;
function gcj02tobd09(lng, lat) {
    let z = lng, y = lat;
    let z_theta = Math.atan2(y, z) + 0.000003 * Math.cos(x_PI * z);
    let z_r = Math.sqrt(z * z + y * y) + 0.00002 * Math.sin(x_PI * y);
    let bd_lng = z_r * Math.cos(z_theta) + 0.0065;
    let bd_lat = z_r * Math.sin(z_theta) + 0.006;
    return [bd_lng, bd_lat];
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixCoordinates() {
    const { data: attractions, error } = await supabase.from('attractions').select('id, name, city, province');
    if (error) {
        console.error("Error fetching attractions:", error);
        return;
    }

    console.log(`Found ${attractions.length} attractions to fix...`);
    let updated = 0;
    
    for (const attr of attractions) {
        const query = encodeURIComponent(`${attr.province}${attr.city}${attr.name}`);
        const url = `https://apis.map.qq.com/ws/geocoder/v1/?address=${query}&key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77`;
        
        try {
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.status === 0 && json.result && json.result.location) {
                const { lng, lat } = json.result.location;
                // Convert to bd09
                const [bdLng, bdLat] = gcj02tobd09(lng, lat);
                
                await supabase.from('attractions').update({
                    longitude: bdLng,
                    latitude: bdLat
                }).eq('id', attr.id);
                
                console.log(`[${updated + 1}/${attractions.length}] Updated ${attr.name} -> ${bdLng.toFixed(5)}, ${bdLat.toFixed(5)}`);
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

fixCoordinates();