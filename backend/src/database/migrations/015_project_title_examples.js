export async function up(connection) {
  await connection.query(`
    CREATE TABLE project_title_examples (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      kind ENUM('project', 'research') NOT NULL,
      title VARCHAR(240) NOT NULL,
      description TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_project_title_examples_title (title),
      KEY idx_project_title_examples_active (is_active, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    INSERT INTO project_title_examples (kind, title, description) VALUES
      ('project', 'Campus Service Request and Maintenance Tracking System',
       'Create a web application where students and staff can report facility issues, route requests to the right office, and track progress through resolution.'),
      ('project', 'Offline-Capable Mobile Attendance and Course Updates Platform',
       'Develop a mobile tool for recording class attendance and sharing course notices, with offline data capture and secure synchronization when internet access returns.'),
      ('project', 'Privacy-Aware Early Academic Support Dashboard',
       'Design a dashboard that helps authorized advisors identify students who may benefit from support using approved academic indicators, with clear access controls and human review.'),
      ('project', 'Crop Disease Reporting and Agricultural Advisory Application',
       'Build a mobile-friendly service for farmers to report crop symptoms, receive locally reviewed guidance, and connect with agricultural extension staff.'),
      ('project', 'University Document Search Assistant with Source References',
       'Create a search tool that answers common questions from approved university documents and links each response to the source information used.'),
      ('research', 'Factors Influencing University Students'' Adoption of Digital Learning Platforms',
       'Study how usability, internet access, digital skills, and instructor support relate to students'' use of online learning platforms.'),
      ('research', 'Study Habits, Online Learning Engagement, and Academic Performance',
       'Examine associations between students'' study routines, participation in online learning, and academic outcomes without assuming that one factor causes another.'),
      ('research', 'Usability and Accessibility of University Websites for Students with Disabilities',
       'Evaluate selected university websites against accessibility guidelines and gather feedback from users to identify practical improvements.'),
      ('research', 'Comparative Evaluation of Lightweight Models for Crop Disease Classification',
       'Compare selected computationally efficient image-classification models on a documented crop-image dataset using consistent accuracy and resource-use measures.'),
      ('research', 'Mobile Payment Adoption and Operational Efficiency in Small Businesses',
       'Investigate how small businesses'' use of mobile payments relates to transaction time, record keeping, and customer service through a clearly defined local study.')
  `)
}
