const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('🌱 Seeding demo data...');

  // Clear existing demo data idempotently
  // Delete org first (cascades most FK constraints), then delete users
  const existingOrg = await prisma.organization.findFirst({ where: { name: 'Fiscalização ABC — Demo' } });
  if (existingOrg) {
    console.log('⚠️  Demo org already exists, cleaning up first...');
    await prisma.organization.delete({ where: { id: existingOrg.id } });
  }
  // Users not cascaded from org (Document.uploadedById → User is RESTRICT)
  // After org delete cascades org-owned data, users can be safely deleted
  await prisma.user.deleteMany({ where: { id: { in: ['demo-user-admin', 'demo-user-gestor', 'demo-user-tecnico'] } } });

  // 1. Create org
  const org = await prisma.organization.create({
    data: {
      id: 'demo-org-001',
      name: 'Fiscalização ABC — Demo',
      slug: 'fiscalizacao-abc-demo',
    }
  });
  console.log('✅ Org created:', org.name);

  // 2. Create 3 users
  const passwordHash = await bcrypt.hash('demo123', 10);
  const admin = await prisma.user.create({
    data: {
      id: 'demo-user-admin',
      email: 'admin@demo.duedilis.com',
      name: 'Ana Coordenadora',
      passwordHash,
    }
  });
  const gestor = await prisma.user.create({
    data: {
      id: 'demo-user-gestor',
      email: 'gestor@demo.duedilis.com',
      name: 'Bruno Gestor',
      passwordHash,
    }
  });
  const tecnico = await prisma.user.create({
    data: {
      id: 'demo-user-tecnico',
      email: 'tecnico@demo.duedilis.com',
      name: 'Carlos Técnico',
      passwordHash,
    }
  });
  console.log('✅ Users created: admin, gestor, tecnico');

  // 3. Create org memberships
  await prisma.orgMembership.createMany({
    data: [
      { id: 'demo-mem-admin', userId: admin.id, orgId: org.id, role: 'ADMIN_ORG' },
      { id: 'demo-mem-gestor', userId: gestor.id, orgId: org.id, role: 'GESTOR_PROJETO' },
      { id: 'demo-mem-tecnico', userId: tecnico.id, orgId: org.id, role: 'TECNICO' },
    ]
  });
  console.log('✅ Memberships created');

  // 4. Create project
  const project = await prisma.project.create({
    data: {
      id: 'demo-project-001',
      orgId: org.id,
      name: 'Edifício Residencial Parque Verde',
      slug: 'edificio-parque-verde',
      description: 'Projecto piloto de fiscalização — dados demo para validação',
    }
  });
  console.log('✅ Project created:', project.name);

  // 5. Project memberships
  await prisma.projectMembership.createMany({
    data: [
      { id: 'demo-pm-admin', userId: admin.id, projectId: project.id, orgId: org.id, role: 'ADMIN_ORG' },
      { id: 'demo-pm-gestor', userId: gestor.id, projectId: project.id, orgId: org.id, role: 'GESTOR_PROJETO' },
      { id: 'demo-pm-tecnico', userId: tecnico.id, projectId: project.id, orgId: org.id, role: 'TECNICO' },
    ]
  });

  // 6. Create CDE folder
  const cdeFolder = await prisma.cdeFolder.create({
    data: {
      id: 'demo-folder-001',
      orgId: org.id,
      projectId: project.id,
      name: 'Documentos Técnicos',
      path: '/demo-org-001/demo-project-001/demo-folder-001',
    }
  });
  console.log('✅ CDE folder created');

  // 7. Create 5 documents with ISO 19650 names
  const docs = await Promise.all([
    prisma.document.create({ data: {
      id: 'demo-doc-001', orgId: org.id, projectId: project.id, folderId: cdeFolder.id,
      originalName: 'plantas_arq_r0.pdf', isoName: 'ABC-PVD-AR-DR-P-0001-S2-P01',
      storageKey: 'demo/doc-001.pdf', fileHash: 'abc001hash', fileSizeBytes: 1024000,
      mimeType: 'application/pdf', uploadedById: admin.id, status: 'CONFIRMED',
    }}),
    prisma.document.create({ data: {
      id: 'demo-doc-002', orgId: org.id, projectId: project.id, folderId: cdeFolder.id,
      originalName: 'estrutura_calc_r1.pdf', isoName: 'ABC-PVD-ST-CA-P-0002-S4-P01',
      storageKey: 'demo/doc-002.pdf', fileHash: 'abc002hash', fileSizeBytes: 2048000,
      mimeType: 'application/pdf', uploadedById: gestor.id, status: 'READY',
    }}),
    prisma.document.create({ data: {
      id: 'demo-doc-003', orgId: org.id, projectId: project.id, folderId: cdeFolder.id,
      originalName: 'instalacoes_eletrica_r0.pdf', isoName: 'ABC-PVD-EL-DR-P-0003-S2-P01',
      storageKey: 'demo/doc-003.pdf', fileHash: 'abc003hash', fileSizeBytes: 512000,
      mimeType: 'application/pdf', uploadedById: tecnico.id, status: 'READY',
    }}),
    prisma.document.create({ data: {
      id: 'demo-doc-004', orgId: org.id, projectId: project.id, folderId: cdeFolder.id,
      originalName: 'memoria_descritiva_r2.docx', isoName: 'ABC-PVD-GN-TX-P-0004-S4-P01',
      storageKey: 'demo/doc-004.docx', fileHash: 'abc004hash', fileSizeBytes: 256000,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedById: admin.id, status: 'CONFIRMED',
    }}),
    prisma.document.create({ data: {
      id: 'demo-doc-005', orgId: org.id, projectId: project.id, folderId: cdeFolder.id,
      originalName: 'plano_seguranca_r0.pdf', isoName: 'ABC-PVD-SF-PL-P-0005-S2-P01',
      storageKey: 'demo/doc-005.pdf', fileHash: 'abc005hash', fileSizeBytes: 768000,
      mimeType: 'application/pdf', uploadedById: gestor.id, status: 'PENDING',
    }}),
  ]);
  console.log('✅ 5 CDE documents created (ISO 19650 names)');

  // 8. Create 3 NCs (Issues) — use correct enum values
  const nc1 = await prisma.issue.create({ data: {
    id: 'demo-issue-001', orgId: org.id, projectId: project.id,
    type: 'NAO_CONFORMIDADE',
    title: 'NC-001: Armadura de aço exposta no pilar P12',
    description: 'Armadura de aço visível no pilar P12, piso 3. Requer intervenção imediata.',
    status: 'ABERTA', priority: 'CRITICA',
    reportedById: tecnico.id, assigneeId: gestor.id,
    location: 'Pilar P12, Piso 3',
  }});
  const nc2 = await prisma.issue.create({ data: {
    id: 'demo-issue-002', orgId: org.id, projectId: project.id,
    type: 'NAO_CONFORMIDADE',
    title: 'NC-002: Desvio dimensional na laje piso 2',
    description: 'Espessura da laje abaixo do especificado em projecto (18cm vs 20cm).',
    status: 'EM_ANALISE', priority: 'ALTA',
    reportedById: tecnico.id, assigneeId: tecnico.id,
    location: 'Laje Piso 2',
  }});
  const nc3 = await prisma.issue.create({ data: {
    id: 'demo-issue-003', orgId: org.id, projectId: project.id,
    type: 'NAO_CONFORMIDADE',
    title: 'NC-003: Impermeabilização incorrecta na cobertura',
    description: 'Membrana de impermeabilização instalada sem sobreposição mínima de 10cm.',
    status: 'FECHADA', priority: 'MEDIA',
    reportedById: gestor.id, assigneeId: admin.id,
    location: 'Cobertura',
  }});
  console.log('✅ 3 NCs (Issues) created');

  // 9. Create 3 photos with GPS metadata
  const photo1 = await prisma.photo.create({ data: {
    id: 'demo-photo-001', orgId: org.id, projectId: project.id, issueId: nc1.id,
    uploadedById: tecnico.id,
    storageKey: 'demo/photo-001.jpg', fileHash: 'photohash001',
    fileSizeBytes: 3145728, mimeType: 'image/jpeg',
    latitude: 38.7169, longitude: -9.1399, altitude: 12.5,
    takenAt: new Date('2026-04-01T09:30:00Z'),
    caption: 'Vista frontal pilar P12 — armadura exposta',
  }});
  const photo2 = await prisma.photo.create({ data: {
    id: 'demo-photo-002', orgId: org.id, projectId: project.id, issueId: nc1.id,
    uploadedById: tecnico.id,
    storageKey: 'demo/photo-002.jpg', fileHash: 'photohash002',
    fileSizeBytes: 2097152, mimeType: 'image/jpeg',
    latitude: 38.7169, longitude: -9.1399, altitude: 12.5,
    takenAt: new Date('2026-04-01T09:32:00Z'),
    caption: 'Vista lateral pilar P12 — detalhe da armadura',
  }});
  const photo3 = await prisma.photo.create({ data: {
    id: 'demo-photo-003', orgId: org.id, projectId: project.id, issueId: nc2.id,
    uploadedById: gestor.id,
    storageKey: 'demo/photo-003.jpg', fileHash: 'photohash003',
    fileSizeBytes: 4194304, mimeType: 'image/jpeg',
    latitude: 38.7170, longitude: -9.1400, altitude: 6.0,
    takenAt: new Date('2026-04-01T14:15:00Z'),
    caption: 'Medição espessura laje piso 2 — desvio dimensional',
  }});
  console.log('✅ 3 fotos de obra com GPS criadas');

  // 10. Create 2 approvals pending
  await prisma.approval.create({ data: {
    id: 'demo-approval-001', orgId: org.id, documentId: docs[1].id,
    submittedById: gestor.id, status: 'PENDING_REVIEW',
  }});
  await prisma.approval.create({ data: {
    id: 'demo-approval-002', orgId: org.id, documentId: docs[2].id,
    submittedById: tecnico.id, status: 'PENDING_REVIEW',
  }});
  console.log('✅ 2 aprovações pendentes criadas');

  // 11. Create 1 meeting with ata
  const meeting = await prisma.meeting.create({ data: {
    id: 'demo-meeting-001', orgId: org.id, projectId: project.id,
    title: 'Reunião de Fiscalização #1 — Parque Verde',
    description: 'Revisão de NCs abertas e aprovação de documentação técnica',
    location: 'Escritório de Obra — Pavilhão A',
    scheduledAt: new Date('2026-04-02T10:00:00Z'),
    endedAt: new Date('2026-04-02T12:00:00Z'),
    status: 'CONCLUIDA',
    createdById: admin.id,
  }});

  // Participants
  await prisma.meetingParticipant.createMany({ data: [
    { id: 'demo-mp-001', orgId: org.id, meetingId: meeting.id, userId: admin.id, name: 'Ana Coordenadora', role: 'Coordenadora de Fiscalização', attended: true },
    { id: 'demo-mp-002', orgId: org.id, meetingId: meeting.id, userId: gestor.id, name: 'Bruno Gestor', role: 'Gestor de Projecto', attended: true },
    { id: 'demo-mp-003', orgId: org.id, meetingId: meeting.id, userId: tecnico.id, name: 'Carlos Técnico', role: 'Técnico de Obra', attended: true },
  ]});

  // Ata (minutes)
  await prisma.meetingMinutes.create({ data: {
    id: 'demo-minutes-001', orgId: org.id, meetingId: meeting.id,
    content: `## Ata de Reunião — 2 de Abril de 2026

### Pontos Discutidos

1. **NC-001 Pilar P12**: Confirmada necessidade de reparação urgente. Prazo: 5 dias úteis.
2. **NC-002 Laje Piso 2**: Aguarda ensaios de carga. Empreiteiro notificado.
3. **Documentação Técnica**: Estrutura R1 em revisão — prazo aprovação 7 dias.

### Decisões
- Empreiteiro deve apresentar plano de reparação NC-001 até 07/04/2026
- Ensaios laje piso 2 agendados para 08/04/2026

### Próxima Reunião
Data: 10/04/2026 às 10h00`,
    publishedAt: new Date('2026-04-02T14:00:00Z'),
    publishedById: admin.id,
  }});

  // Action items
  await prisma.actionItem.createMany({ data: [
    {
      id: 'demo-ai-001', orgId: org.id, meetingId: meeting.id,
      description: 'Apresentar plano de reparação NC-001 (pilar P12)',
      assigneeId: gestor.id, dueDate: new Date('2026-04-07'), status: 'PENDENTE',
    },
    {
      id: 'demo-ai-002', orgId: org.id, meetingId: meeting.id,
      description: 'Agendar ensaios de carga na laje piso 2',
      assigneeId: tecnico.id, dueDate: new Date('2026-04-08'), status: 'EM_PROGRESSO',
    },
  ]});
  console.log('✅ Reunião com ata e 2 action items criada');

  // 12. Evidence links: Meeting↔Documento (schema FK constraint: sourceId→Meeting.id)
  // Note: EvidenceLink_sourceId_fkey points to Meeting — so sourceType must be 'Meeting'
  const hashLink1 = crypto.createHash('sha256').update('demo-meeting-001-demo-doc-001').digest('hex');
  const hashLink2 = crypto.createHash('sha256').update('demo-meeting-001-demo-doc-002').digest('hex');
  const hashLink3 = crypto.createHash('sha256').update('demo-meeting-001-demo-doc-003').digest('hex');

  await prisma.evidenceLink.createMany({ data: [
    {
      id: 'demo-ev-001', orgId: org.id, projectId: project.id,
      sourceType: 'Meeting', sourceId: meeting.id,
      targetType: 'Document', targetId: docs[0].id,
      description: 'Reunião referencia planta arquitectura (plantas ARQ)',
      createdById: admin.id, hash: hashLink1,
    },
    {
      id: 'demo-ev-002', orgId: org.id, projectId: project.id,
      sourceType: 'Meeting', sourceId: meeting.id,
      targetType: 'Document', targetId: docs[1].id,
      description: 'Reunião referencia cálculo estrutural em revisão',
      createdById: gestor.id, hash: hashLink2,
    },
    {
      id: 'demo-ev-003', orgId: org.id, projectId: project.id,
      sourceType: 'Meeting', sourceId: meeting.id,
      targetType: 'Document', targetId: docs[2].id,
      description: 'Reunião referencia instalações eléctricas',
      createdById: admin.id, hash: hashLink3,
    },
  ]});
  console.log('✅ Links probatórios Reunião↔Documentos criados');

  // 13. Create 2 in-app notifications
  await prisma.notification.createMany({ data: [
    {
      id: 'demo-notif-001', orgId: org.id, userId: gestor.id,
      type: 'APPROVAL_REQUESTED',
      title: 'Aprovação solicitada: Estrutura Cálculo R1',
      body: 'O documento "ABC-PVD-ST-CA-P-0002-S4-P01" foi submetido para aprovação.',
      entityType: 'Document',
      entityId: 'demo-doc-002',
      read: false,
    },
    {
      id: 'demo-notif-002', orgId: org.id, userId: admin.id,
      type: 'ISSUE_CREATED',
      title: 'Nova NC: NC-001 — Armadura exposta pilar P12',
      body: 'Carlos Técnico registou uma NC crítica no projecto Parque Verde.',
      entityType: 'Issue',
      entityId: 'demo-issue-001',
      read: false,
    },
  ]});
  console.log('✅ 2 notificações in-app criadas');

  console.log('\n🎉 Seed completo!');
  console.log('\n📋 Credenciais demo:');
  console.log('  admin@demo.duedilis.com / demo123 (ADMIN_ORG)');
  console.log('  gestor@demo.duedilis.com / demo123 (GESTOR_PROJETO)');
  console.log('  tecnico@demo.duedilis.com / demo123 (TECNICO)');
}

seed()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
