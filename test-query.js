const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://yorlin:tTZRLoQtP4O68cO2@cluster1.tkgei.mongodb.net/appUniversal');
    const db = mongoose.connection.db;

    const mongoQuery = {
        activo: true,
        $and: [
            {
                $or: [
                    { grupoRubro: { $in: [ /INVERSIÓN TRANSPORTES/i ] } },
                    { nombreGrupoRubro: { $in: [ /INVERSIÓN TRANSPORTES/i ] } },
                    { grupoRubro: { $in: [ "106005" ] } },
                    { nombreGrupoRubro: { $in: [ "106005" ] } }
                ]
            },
            {
                $or: [
                    {
                        $or: [
                            { fechaPago: { $gte: new Date("2026-01-01"), $lte: new Date("2026-01-31") } },
                            {
                                $and: [
                                    { $or: [{ fechaPago: { $exists: false } }, { fechaPago: null }] },
                                    { fecha: { $gte: new Date("2026-01-01"), $lte: new Date("2026-01-31") } }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    console.log("Testing month + group combo query:");
    const results = await db.collection('pagos').find(mongoQuery).toArray();
    console.log(`Found ${results.length} payments.`);

    if (results.length === 0) {
        // Let's test just the group
        const groupQuery = {
            activo: true,
            $and: [ mongoQuery.$and[0] ]
        };
        const groupResults = await db.collection('pagos').find(groupQuery).toArray();
        console.log(`Found ${groupResults.length} payments with JUST group.`);
        if (groupResults.length > 0) {
            console.log("Sample dates from group matching payments:");
            groupResults.forEach(r => {
                console.log(`- fechaPago: ${r.fechaPago}, fecha: ${r.fecha}`);
            });
        }
    }

    process.exit(0);
}

run();
