const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/tanqueo');
    console.log('Connected');
    
    // Find a payment that might belong to INVERSIÓN TRANSPORTES
    const db = mongoose.connection.db;
    
    console.log('Searching for 67b64d6ec70c84f175463246');
    const pagos = await db.collection('pagos').find({ dependencia: '67b64d6ec70c84f175463246' }).limit(5).toArray();
    console.log('Pagos:', pagos.map(p => ({ id: p._id, grupoRubro: p.grupoRubro, nombreGrupoRubro: p.nombreGrupoRubro })));

    console.log('Searching for 683b0fa595ceca0eacf2ddf4');
    const pagos3 = await db.collection('pagos').find({ grupoRubro: '683b0fa595ceca0eacf2ddf4' }).limit(5).toArray();
    console.log('Pagos ObjectId:', pagos3.map(p => ({ id: p._id, grupoRubro: p.grupoRubro, nombreGrupoRubro: p.nombreGrupoRubro })));

    console.log('Searching for MANTENIMIENTO');
    const pagos4 = await db.collection('pagos').find({ grupoRubro: /MANTENIMIENTO/i }).limit(2).toArray();
    console.log('Pagos MANTENIMIENTO:', pagos4.map(p => ({ id: p._id, grupoRubro: p.grupoRubro, nombreGrupoRubro: p.nombreGrupoRubro })));

    console.log('Searching for INVERSIÓN');
    const pagos5 = await db.collection('pagos').find({ $or: [{grupoRubro: /INVERSIÓN/i}, {nombreGrupoRubro: /INVERSIÓN/i}] }).limit(2).toArray();
    console.log('Pagos INVERSION:', pagos5.map(p => ({ id: p._id, grupoRubro: p.grupoRubro, nombreGrupoRubro: p.nombreGrupoRubro })));

    process.exit(0);
}

run();
