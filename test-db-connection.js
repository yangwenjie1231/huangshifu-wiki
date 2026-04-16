import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Try to connect and query
    const userCount = await prisma.user.count();
    console.log(`✓ Database connected successfully!`);
    console.log(`  Total users in database: ${userCount}`);
    
    // Try to create a test user if none exists
    if (userCount === 0) {
      console.log('\nCreating test user...');
      const passwordHash = await bcrypt.hash('test123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          passwordHash,
          displayName: 'Test User',
          bio: '',
        },
      });
      console.log(`✓ Test user created: ${user.email}`);
    } else {
      // Show first user
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        console.log(`\nFirst user in database:`);
        console.log(`  Email: ${firstUser.email}`);
        console.log(`  Display Name: ${firstUser.displayName}`);
      }
    }
    
    console.log('\n✓ Database test completed successfully!');
    
  } catch (error) {
    console.error('✗ Database connection failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
