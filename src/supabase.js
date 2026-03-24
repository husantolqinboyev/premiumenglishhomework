const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// =============================================
// USER FUNCTIONS
// =============================================

async function getUserByTelegramId(telegramId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

async function getUserRole(telegramId) {
  const user = await getUserByTelegramId(telegramId);
  return user ? user.role : null;
}

async function createUser(telegramId, name, role = 'student') {
  const { data, error } = await supabase
    .from('users')
    .upsert({ telegram_id: telegramId, name, role }, { onConflict: 'telegram_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateUserRole(telegramId, role) {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('telegram_id', telegramId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// =============================================
// TEACHER FUNCTIONS
// =============================================

async function getTeachers() {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });
  return data || [];
}

async function getTeacherById(userId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('role', 'teacher')
    .single();
  return data;
}

async function deleteTeacher(userId) {
  await supabase.from('users').update({ role: 'student' }).eq('id', userId);
}

// =============================================
// GROUP FUNCTIONS
// =============================================

async function createGroup(name, description, teacherId, link, assistantTeacherId = null) {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      teacher_id: teacherId,
      assistant_teacher_id: assistantTeacherId,
      link
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getGroupsByTeacher(teacherUserId) {
  const { data } = await supabase
    .from('groups')
    .select('*, teacher:teacher_id(name, telegram_id)')
    .or(`teacher_id.eq.${teacherUserId},assistant_teacher_id.eq.${teacherUserId}`)
    .order('created_at', { ascending: false });
  return data || [];
}

async function getAllGroups() {
  const { data } = await supabase
    .from('groups')
    .select('*, teacher:teacher_id(name, telegram_id)')
    .order('created_at', { ascending: false });
  return data || [];
}

async function getGroupById(groupId) {
  const { data } = await supabase
    .from('groups')
    .select('*, teacher:teacher_id(name, telegram_id)')
    .eq('id', groupId)
    .single();
  return data;
}

async function updateGroup(groupId, updates) {
  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGroup(groupId) {
  await supabase.from('groups').delete().eq('id', groupId);
}

// =============================================
// STUDENT FUNCTIONS
// =============================================

async function addStudentToGroup(telegramId, name, groupId) {
  // Avval user yaratamiz yoki topamiz
  let user = await getUserByTelegramId(telegramId);
  if (!user) {
    user = await createUser(telegramId, name, 'student');
  } else {
    // Agar user bo'lsa, rolini student qilamiz
    await supabase.from('users').update({ role: 'student', name }).eq('telegram_id', telegramId);
  }

  // O'quvchi jadvalida bormi?
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (existingStudent) {
    // Bor bo'lsa guruhini yangilaymiz
    const { data, error } = await supabase
      .from('students')
      .update({ name, group_id: groupId })
      .eq('id', existingStudent.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Yo'q bo'lsa yangi yaratamiz
    const { data, error } = await supabase
      .from('students')
      .insert({ telegram_id: telegramId, name, group_id: groupId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function getStudentsByGroup(groupId) {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_date', { ascending: false });
  return data || [];
}

async function getStudentByTelegramId(telegramId) {
  const { data } = await supabase
    .from('students')
    .select('*, group:group_id(name, teacher_id)')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

async function getStudentById(studentId) {
  const { data } = await supabase
    .from('students')
    .select('*, group:group_id(name)')
    .eq('id', studentId)
    .single();
  return data;
}

async function updateStudent(studentId, updates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteStudent(studentId) {
  await supabase.from('students').delete().eq('id', studentId);
}

// =============================================
// COIN FUNCTIONS
// =============================================

async function addCoins(studentId, amount, reason = '') {
  const { data, error } = await supabase
    .from('coins')
    .insert({ student_id: studentId, amount, reason })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getStudentTotalCoins(studentId) {
  const { data } = await supabase.rpc('get_student_total_coins', { p_student_id: studentId });
  return data || 0;
}

async function getStudentMonthlyCoins(studentId) {
  const { data } = await supabase.rpc('get_student_monthly_coins', { p_student_id: studentId });
  return data || 0;
}

async function getCoinHistory(studentId) {
  const { data } = await supabase
    .from('coins')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

// =============================================
// HOMEWORK FUNCTIONS
// =============================================

async function createHomework(groupId, description, fileIds, deadline) {
  const { data, error } = await supabase
    .from('homeworks')
    .insert({
      group_id: groupId,
      description,
      file_ids: fileIds,
      deadline
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getHomeworksByGroup(groupId) {
  const { data } = await supabase
    .from('homeworks')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  return data || [];
}

async function getHomeworkById(homeworkId) {
  const { data } = await supabase
    .from('homeworks')
    .select('*')
    .eq('id', homeworkId)
    .single();
  return data;
}

// =============================================
// HOMEWORK SUBMISSION FUNCTIONS
// =============================================

async function submitHomework(studentId, homeworkId, fileIds, comment) {
  const { data, error } = await supabase
    .from('homework_submissions')
    .insert({
      student_id: studentId,
      homework_id: homeworkId,
      file_ids: fileIds,
      comment
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getSubmissionsByHomework(homeworkId) {
  const { data } = await supabase
    .from('homework_submissions')
    .select('*, student:student_id(name, telegram_id)')
    .eq('homework_id', homeworkId)
    .order('submitted_at', { ascending: false });
  return data || [];
}

async function getSubmissionsByStudent(studentId) {
  const { data } = await supabase
    .from('homework_submissions')
    .select('*, homework:homework_id(description, deadline, created_at)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  return data || [];
}

async function getCheckedSubmissions(studentId) {
  const { data } = await supabase
    .from('homework_submissions')
    .select('*, homework:homework_id(description, deadline, created_at)')
    .eq('student_id', studentId)
    .eq('checked', true)
    .order('checked_at', { ascending: false });
  return data || [];
}

async function checkSubmission(submissionId, feedback) {
  const { data, error } = await supabase
    .from('homework_submissions')
    .update({ checked: true, feedback, checked_at: new Date().toISOString() })
    .eq('id', submissionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getSubmissionById(submissionId) {
  const { data } = await supabase
    .from('homework_submissions')
    .select('*, student:student_id(name, telegram_id), homework:homework_id(description)')
    .eq('id', submissionId)
    .single();
  return data;
}

// =============================================
// STATISTICS FUNCTIONS
// =============================================

async function getGroupStats(groupId) {
  const students = await getStudentsByGroup(groupId);
  const result = [];

  for (const student of students) {
    const monthlyCoins = await getStudentMonthlyCoins(student.id);
    const totalCoins = await getStudentTotalCoins(student.id);
    result.push({ ...student, monthlyCoins, totalCoins });
  }

  result.sort((a, b) => b.monthlyCoins - a.monthlyCoins);
  return result;
}

async function getTeacherStats(teacherUserId) {
  const groups = await getGroupsByTeacher(teacherUserId);
  const result = [];

  for (const group of groups) {
    const students = await getStudentsByGroup(group.id);
    result.push({ ...group, studentCount: students.length });
  }
  return result;
}

async function getStudentFullStats(studentId) {
  const submissions = await getSubmissionsByStudent(studentId);
  const totalCoins = await getStudentTotalCoins(studentId);
  const monthlyCoins = await getStudentMonthlyCoins(studentId);
  return { submissions, totalCoins, monthlyCoins };
}

module.exports = {
  supabase,
  getUserByTelegramId,
  getUserRole,
  createUser,
  updateUserRole,
  getTeachers,
  getTeacherById,
  deleteTeacher,
  createGroup,
  getGroupsByTeacher,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addStudentToGroup,
  getStudentsByGroup,
  getStudentByTelegramId,
  getStudentById,
  updateStudent,
  deleteStudent,
  addCoins,
  getStudentTotalCoins,
  getStudentMonthlyCoins,
  getCoinHistory,
  createHomework,
  getHomeworksByGroup,
  getHomeworkById,
  submitHomework,
  getSubmissionsByHomework,
  getSubmissionsByStudent,
  getCheckedSubmissions,
  checkSubmission,
  getSubmissionById,
  getGroupStats,
  getTeacherStats,
  getStudentFullStats
};
