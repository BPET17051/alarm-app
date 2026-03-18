"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
if (!config_1.SUPABASE_URL || !config_1.SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
}
const supabase = (0, supabase_js_1.createClient)(config_1.SUPABASE_URL, config_1.SUPABASE_KEY);
exports.default = supabase;
//# sourceMappingURL=db.js.map