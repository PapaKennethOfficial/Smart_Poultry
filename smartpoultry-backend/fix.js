const prisma = require('./src/config/prisma');

async function run() {
  const users = await prisma.user.findMany({
    where: { OR: [{ deliveryStaffStatus: { not: null } }, { email: { contains: 'driver' } }] }
  });
  console.log("Users to fix:", users.map(u => u.email + ' : ' + u.role));
  
  const res = await prisma.user.updateMany({
    where: { id: { in: users.map(u => u.id) } },
    data: { role: 'DELIVERY' }
  });
  console.log("Updated", res);
}
run().catch(console.error).finally(() => prisma.$disconnect());
