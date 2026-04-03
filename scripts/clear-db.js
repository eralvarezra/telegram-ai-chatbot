const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllTables() {
  console.log('🧹 Limpiando todas las tablas...\n');

  try {
    // Delete in order respecting foreign key constraints
    // Child tables first, then parent tables

    console.log('1. Limpiando UsageTracking...');
    await prisma.usageTracking.deleteMany({});
    console.log('   ✓ UsageTracking limpiada');

    console.log('2. Limpiando ConversationMemory...');
    await prisma.conversationMemory.deleteMany({});
    console.log('   ✓ ConversationMemory limpiada');

    console.log('3. Limpiando Agent...');
    await prisma.agent.deleteMany({});
    console.log('   ✓ Agent limpiada');

    console.log('4. Limpiando AgentTemplate...');
    await prisma.agentTemplate.deleteMany({});
    console.log('   ✓ AgentTemplate limpiada');

    console.log('5. Limpiando Message...');
    await prisma.message.deleteMany({});
    console.log('   ✓ Message limpiada');

    console.log('6. Limpiando MediaView...');
    await prisma.mediaView.deleteMany({});
    console.log('   ✓ MediaView limpiada');

    console.log('7. Limpiando PaymentProof...');
    await prisma.paymentProof.deleteMany({});
    console.log('   ✓ PaymentProof limpiada');

    console.log('8. Limpiando Payment...');
    await prisma.payment.deleteMany({});
    console.log('   ✓ Payment limpiada');

    console.log('9. Limpiando MediaContent...');
    await prisma.mediaContent.deleteMany({});
    console.log('   ✓ MediaContent limpiada');

    console.log('10. Limpiando Product...');
    await prisma.product.deleteMany({});
    console.log('   ✓ Product limpiada');

    console.log('11. Limpiando BlockedUser...');
    await prisma.blockedUser.deleteMany({});
    console.log('   ✓ BlockedUser limpiada');

    console.log('12. Limpiando BotConfigVersion...');
    await prisma.botConfigVersion.deleteMany({});
    console.log('   ✓ BotConfigVersion limpiada');

    console.log('13. Limpiando AIConfigGeneration...');
    await prisma.aIConfigGeneration.deleteMany({});
    console.log('   ✓ AIConfigGeneration limpiada');

    console.log('14. Limpiando Notification...');
    await prisma.notification.deleteMany({});
    console.log('   ✓ Notification limpiada');

    console.log('15. Limpiando UserSession...');
    await prisma.userSession.deleteMany({});
    console.log('   ✓ UserSession limpiada');

    console.log('16. Limpiando Invoice...');
    await prisma.invoice.deleteMany({});
    console.log('   ✓ Invoice limpiada');

    console.log('17. Limpiando UserPaymentMethod...');
    await prisma.userPaymentMethod.deleteMany({});
    console.log('   ✓ UserPaymentMethod limpiada');

    console.log('18. Limpiando Subscription...');
    await prisma.subscription.deleteMany({});
    console.log('   ✓ Subscription limpiada');

    console.log('19. Limpiando UserCredentials...');
    await prisma.userCredentials.deleteMany({});
    console.log('   ✓ UserCredentials limpiada');

    console.log('20. Limpiando User...');
    await prisma.user.deleteMany({});
    console.log('   ✓ User limpiada');

    console.log('21. Limpiando PaymentMethodConfig...');
    await prisma.paymentMethodConfig.deleteMany({});
    console.log('   ✓ PaymentMethodConfig limpiada');

    console.log('22. Limpiando BotConfig...');
    await prisma.botConfig.deleteMany({});
    console.log('   ✓ BotConfig limpiada');

    console.log('23. Limpiando AppSetup...');
    await prisma.appSetup.deleteMany({});
    console.log('   ✓ AppSetup limpiada');

    console.log('24. Limpiando AdminUser...');
    await prisma.adminUser.deleteMany({});
    console.log('   ✓ AdminUser limpiada');

    console.log('\n✅ Todas las tablas han sido limpiadas correctamente!');

  } catch (error) {
    console.error('❌ Error limpiando tablas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllTables();