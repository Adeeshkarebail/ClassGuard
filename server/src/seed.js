const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');

async function seedDatabase() {
  console.log('Initializing ClassGuard AI database with initial personas and institutional data...');

  // Ensure DB initialized
  if (db.initDatabase) {
    await db.initDatabase();
  }

  // System Settings Defaults
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value, description)
    VALUES (?, ?, ?)
  `);
  insertSetting.run('ear_drowsiness_threshold', '0.20', 'Eye Aspect Ratio threshold below which eye is considered closed');
  insertSetting.run('eye_closure_duration_sec', '5.0', 'Continuous eye closure duration in seconds to trigger sleeping alert');
  insertSetting.run('yaw_distraction_threshold_deg', '28.0', 'Head pose yaw angle in degrees away from board to trigger distraction flag');
  insertSetting.run('retention_period_days', '7', 'Automatic deletion retention window for temporary event snapshots');

  // Initial Academic Classes
  const existingClasses = db.prepare('SELECT count(*) as count FROM classes').get()?.count || 0;
  let c1Id = 1;
  if (existingClasses === 0) {
    const insertClass = db.prepare(`
      INSERT INTO classes (name, department, semester, academic_year)
      VALUES (?, ?, ?, ?)
    `);
    const c1 = insertClass.run('8th Semester CSE - Section A', 'Computer Science & Engineering', '8', '2025-2026');
    c1Id = c1.lastInsertRowid;
    insertClass.run('6th Semester ISE - Section B', 'Information Science & Engineering', '6', '2025-2026');
    insertClass.run('4th Semester AIML - Section A', 'AI & Machine Learning', '4', '2025-2026');
  }

  // Initial Classrooms
  const existingClassrooms = db.prepare('SELECT count(*) as count FROM classrooms').get()?.count || 0;
  if (existingClassrooms === 0) {
    const insertClassroom = db.prepare(`
      INSERT INTO classrooms (id, classroom_code, name, class_id, camera_source, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertClassroom.run(1, 'CR-402', 'Room 402 — Advanced Computing Lab', c1Id, 'Integrated Webcam', 'MONITORING');
    insertClassroom.run(2, 'CR-201', 'Room 201 — Main Lecture Hall', c1Id, 'Integrated Webcam', 'IDLE');
  }

  // Check if Admin exists
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
  if (!existingAdmin) {
    const adminPassHash = bcrypt.hashSync('Admin@123', 10);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, full_name, institution_id)
      VALUES (?, ?, ?, 'ADMIN', ?, ?)
    `).run('admin', 'admin@classguard.edu', adminPassHash, 'Dr. Suresh Sharma', 'INST-CSE-001');
    console.log('✓ Created Super Admin persona: admin / Admin@123 (admin@classguard.edu)');
  }

  // Check if Teacher exists
  const existingTeacherUser = db.prepare("SELECT id FROM users WHERE role = 'TEACHER' LIMIT 1").get();
  let teacherRecordId = 1;
  if (!existingTeacherUser) {
    const teacherPassHash = bcrypt.hashSync('Teacher@123', 10);
    const tUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, full_name, institution_id)
      VALUES (?, ?, ?, 'TEACHER', ?, ?)
    `).run('teacher_prof', 'teacher@classguard.edu', teacherPassHash, 'Prof. Meera Kulkarni', 'INST-CSE-001');

    const tRecord = db.prepare(`
      INSERT INTO teachers (user_id, employee_id, full_name, department, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(tUser.lastInsertRowid, 'EMP-CSE-104', 'Prof. Meera Kulkarni', 'Computer Science & Engineering', '+91 98450 12345');
    teacherRecordId = tRecord.lastInsertRowid;
    console.log('✓ Created Class Teacher persona: teacher_prof / Teacher@123 (teacher@classguard.edu)');

    // Assign teacher to classroom CR-402
    try {
      db.prepare('UPDATE classrooms SET teacher_id = ? WHERE classroom_code = ?').run(teacherRecordId, 'CR-402');
    } catch (e) {}
  }

  // Check if Students exist
  const existingStudentCount = db.prepare('SELECT count(*) as count FROM students').get()?.count || 0;
  if (existingStudentCount === 0) {
    const studentPassHash = bcrypt.hashSync('Student@123', 10);

    const studentsData = [
      {
        username: 'rahul_k',
        email: 'student@classguard.edu',
        fullName: 'Rahul Kumar',
        studentId: '1MS22CS101',
        rollNumber: 'CS-01',
        consent: 'CONSENTED',
        phone: '+91 98765 11001',
      },
      {
        username: 'ananya_r',
        email: 'ananya@classguard.edu',
        fullName: 'Ananya Rao',
        studentId: '1MS22CS102',
        rollNumber: 'CS-02',
        consent: 'CONSENTED',
        phone: '+91 98765 11002',
      },
      {
        username: 'priya_s',
        email: 'priya@classguard.edu',
        fullName: 'Priya Sharma',
        studentId: '1MS22CS103',
        rollNumber: 'CS-03',
        consent: 'CONSENTED',
        phone: '+91 98765 11003',
      },
      {
        username: 'kiran_g',
        email: 'kiran@classguard.edu',
        fullName: 'Kiran Gowda',
        studentId: '1MS22CS104',
        rollNumber: 'CS-04',
        consent: 'WITHDRAWN',
        phone: '+91 98765 11004',
      },
    ];

    for (const s of studentsData) {
      const uRes = db.prepare(`
        INSERT INTO users (username, email, password_hash, role, full_name, institution_id)
        VALUES (?, ?, ?, 'STUDENT', ?, ?)
      `).run(s.username, s.email, studentPassHash, s.fullName, 'INST-CSE-001');

      const sRes = db.prepare(`
        INSERT INTO students (student_id, user_id, full_name, class_name, section, roll_number, email, phone, consent_status, is_demo)
        VALUES (?, ?, ?, '8th Semester CSE - Section A', 'A', ?, ?, ?, ?, 0)
      `).run(s.studentId, uRes.lastInsertRowid, s.fullName, s.rollNumber, s.email, s.phone, s.consent);

      const studentPk = sRes.lastInsertRowid;

      // Consent record
      const consentStatus = s.consent === 'CONSENTED' ? 'ACTIVE' : 'REVOKED';
      db.prepare(`
        INSERT INTO consents (student_id, consent_type, granted_by, status, terms_version, ip_address, revoked_at)
        VALUES (?, 'CLASSROOM_SAFETY_ATTENTION_MONITORING', ?, ?, 'v1.4-PrivacyFirst', '127.0.0.1', ?)
      `).run(studentPk, `${s.fullName} (Self Registered)`, consentStatus, s.consent === 'WITHDRAWN' ? new Date().toISOString() : null);

      // Biometric token
      const secureHash = crypto.createHash('sha256').update(`${s.studentId}:${s.fullName}`).digest('hex');
      const bioStatus = s.consent === 'CONSENTED' ? 'ACTIVE' : 'PURGED';
      db.prepare(`
        INSERT INTO biometric_profiles (student_id, feature_vector_hash, feature_vector_encrypted, quality_score, status, purged_at)
        VALUES (?, ?, ?, 0.96, ?, ?)
      `).run(
        studentPk,
        `sha256:${secureHash}`,
        s.consent === 'CONSENTED' ? 'enc:aes256gcm:enrolled' : '[PURGED_ON_WITHDRAWAL]',
        bioStatus,
        s.consent === 'WITHDRAWN' ? new Date().toISOString() : null
      );

      // Enrollment in Classroom 1
      try {
        db.prepare('INSERT OR IGNORE INTO enrollments (student_id, classroom_id) VALUES (?, 1)').run(studentPk);
      } catch (e) {}
    }

    console.log('✓ Created 4 student profiles with biometric consents and enrollments.');
  }

  // Ensure default active monitoring session exists
  const existingSession = db.prepare('SELECT id FROM monitoring_sessions WHERE id = 1').get();
  if (!existingSession) {
    db.prepare(`
      INSERT INTO monitoring_sessions (id, session_code, classroom_id, started_at, status, avg_attention_score, avg_drowsiness_rate, avg_noise_level, potential_events_count, verified_events_count)
      VALUES (1, 'SESS-LIVE-01', 1, datetime('now', '-45 minutes'), 'ACTIVE', 86.4, 4.8, 'MODERATE', 3, 1)
    `).run();
  }

  // Ensure timeline markers exist for session 1
  const markersCount = db.prepare('SELECT count(*) as count FROM session_timeline_markers WHERE session_id = 1').get()?.count || 0;
  if (markersCount === 0) {
    const insertMarker = db.prepare(`
      INSERT INTO session_timeline_markers (session_id, marker_type, title, notes, timestamp)
      VALUES (1, ?, ?, ?, datetime('now', ?))
    `);
    insertMarker.run('TOPIC_START', 'Distributed Systems & Vector Clocks', 'Lecture started by Prof. Meera Kulkarni', '-40 minutes');
    insertMarker.run('ATTENTION_DROP', 'Drowsiness Detected in Desk #1', 'EAR dropped below threshold 0.20', '-22 minutes');
    insertMarker.run('TEACHER_INTERACTION', 'Interactive Q&A Session', 'Teacher engaged students with poll question', '-15 minutes');
    insertMarker.run('RECOVERY', 'Attention Restored to 92%', 'Class average attention rose significantly', '-8 minutes');
  }

  // Ensure some authentic sample detected events exist for historical review and audit tests
  const eventsCount = db.prepare('SELECT count(*) as count FROM detected_events').get()?.count || 0;
  if (eventsCount === 0) {
    const s1 = db.prepare("SELECT id, full_name FROM students WHERE student_id = '1MS22CS101'").get();
    const s2 = db.prepare("SELECT id, full_name FROM students WHERE student_id = '1MS22CS102'").get();

    // Event 1: Prolonged eye closure (verified sleeping by teacher)
    const e1 = db.prepare(`
      INSERT INTO detected_events (
        session_id, student_id, student_name_snapshot, event_type, category,
        confidence_score, duration_seconds, verification_status, ai_observation,
        camera_id, is_simulated, teacher_notes, verified_by, verified_at, timestamp
      )
      VALUES (
        1, ?, ?, 'PROLONGED_EYE_CLOSURE', 'ATTENTION',
        0.94, 5.8, 'VERIFIED', 'Continuous eye closure detected (EAR: 0.14) for >5.0s during theory lecture.',
        'CAM-01 (Integrated)', 0, 'Class teacher verified student was asleep during lecture, nudged gently.',
        'Prof. Meera Kulkarni', datetime('now', '-20 minutes'), datetime('now', '-22 minutes')
      )
    `).run(s1?.id || 1, s1?.full_name || 'Rahul Kumar');

    // Verification record for event 1
    db.prepare(`
      INSERT INTO teacher_verifications (event_id, teacher_id, decision, notes, verified_at)
      VALUES (?, 1, 'VERIFIED', 'Class teacher verified student was asleep during lecture, nudged gently.', datetime('now', '-20 minutes'))
    `).run(e1.lastInsertRowid);

    // Event 2: Classroom disturbance (pending review)
    db.prepare(`
      INSERT INTO detected_events (
        session_id, student_id, student_name_snapshot, event_type, category,
        confidence_score, duration_seconds, verification_status, ai_observation,
        camera_id, is_simulated, timestamp
      )
      VALUES (
        1, ?, ?, 'CLASSROOM_DISTURBANCE', 'DISTURBANCE',
        0.87, 6.2, 'PENDING', 'Repeated head yaw deviation (>32°) facing adjacent desk for extended period.',
        'CAM-01 (Integrated)', 0, datetime('now', '-12 minutes')
      )
    `).run(s2?.id || 2, s2?.full_name || 'Ananya Rao');

    // Event 3: Physical Conflict / Safety alert (marked false positive by teacher)
    const e3 = db.prepare(`
      INSERT INTO detected_events (
        session_id, student_id, student_name_snapshot, event_type, category,
        confidence_score, duration_seconds, verification_status, ai_observation,
        camera_id, is_simulated, teacher_notes, verified_by, verified_at, timestamp
      )
      VALUES (
        1, ?, ?, 'PHYSICAL_CONFLICT', 'SAFETY',
        0.82, 3.4, 'REJECTED', 'Rapid sudden motion velocity detected in classroom center aisle.',
        'CAM-01 (Integrated)', 0, 'Students were exchanging textbook notebooks, not a physical altercation.',
        'Prof. Meera Kulkarni', datetime('now', '-5 minutes'), datetime('now', '-6 minutes')
      )
    `).run(s1?.id || 1, s1?.full_name || 'Rahul Kumar');

    db.prepare(`
      INSERT INTO teacher_verifications (event_id, teacher_id, decision, notes, verified_at)
      VALUES (?, 1, 'FALSE_POSITIVE', 'Students were exchanging textbook notebooks, not a physical altercation.', datetime('now', '-5 minutes'))
    `).run(e3.lastInsertRowid);
  }

  // System audit logs
  const auditCount = db.prepare('SELECT count(*) as count FROM audit_logs').get()?.count || 0;
  if (auditCount === 0) {
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_name, user_role, action, resource_type, resource_id, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1', datetime('now', ?))
    `);
    insertAudit.run('SYSTEM', 'SYSTEM', 'SYSTEM_BOOTSTRAP', 'SYSTEM', 'CORE', 'ClassGuard AI core security framework initialized', '-1 hour');
    insertAudit.run('Dr. Suresh Sharma', 'ADMIN', 'SETTINGS_CONFIGURED', 'SETTINGS', 'CONFIG', 'Data retention policy enforced at 7 days with local inference guarantee', '-55 minutes');
    insertAudit.run('Prof. Meera Kulkarni', 'TEACHER', 'MONITORING_STARTED', 'MONITORING_SESSION', '1', 'Started monitoring session in Room 402', '-45 minutes');
    insertAudit.run('Prof. Meera Kulkarni', 'TEACHER', 'STUDENT_SLEEPING_VERIFIED', 'EVENT', '1', 'Verified prolonged eye closure for Rahul Kumar with note', '-20 minutes');
  }

  console.log('✓ Database seeding complete and ready for student, teacher, and admin operations.');
}

if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = seedDatabase;
