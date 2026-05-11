const {query}=require('./server/database');
query('SHOW TABLES').then(r=>{r.forEach(t=>console.log(Object.values(t)[0]));process.exit(0);}).catch(e=>{console.error(e.message);process.exit(1);});
