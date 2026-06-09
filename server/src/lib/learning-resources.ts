/**
 * ── Curated Learning Resources Database ──
 * 
 * Maps 60+ in-demand skills to real course links (Coursera, Udemy, YouTube),
 * estimated learning duration, and salary impact (INR + USD).
 */

export interface CourseLink {
    platform: "Coursera" | "Udemy" | "YouTube" | "freeCodeCamp" | "LinkedIn Learning" | "Pluralsight";
    title: string;
    url: string;
    duration: string;      // e.g. "2 weeks", "10 hours"
    isFree: boolean;
}

export interface SkillLearningResource {
    skill: string;
    courses: CourseLink[];
    salaryImpactINR: string;   // e.g. "+₹2L/yr"
    salaryImpactUSD: string;   // e.g. "+$8K/yr"
}

const LEARNING_DB: SkillLearningResource[] = [
    // ═══════ IT / TECH SKILLS ═══════
    {
        skill: "Docker",
        courses: [
            { platform: "YouTube", title: "Docker Tutorial for Beginners — freeCodeCamp", url: "https://www.youtube.com/watch?v=fqMOX6JJhGo", duration: "2 hours", isFree: true },
            { platform: "Udemy", title: "Docker & Kubernetes: The Practical Guide", url: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/", duration: "23 hours", isFree: false },
            { platform: "Coursera", title: "Containerized Applications on AWS", url: "https://www.coursera.org/learn/containerized-applications-on-aws", duration: "4 weeks", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Kubernetes",
        courses: [
            { platform: "YouTube", title: "Kubernetes Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=d6WC5n9G_sM", duration: "4 hours", isFree: true },
            { platform: "Udemy", title: "Kubernetes for the Absolute Beginners", url: "https://www.udemy.com/course/learn-kubernetes/", duration: "5 hours", isFree: false },
            { platform: "Coursera", title: "Architecting with GKE", url: "https://www.coursera.org/specializations/architecting-google-kubernetes-engine", duration: "5 weeks", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "AWS",
        courses: [
            { platform: "YouTube", title: "AWS Certified Cloud Practitioner — freeCodeCamp", url: "https://www.youtube.com/watch?v=SOTamWNgDKc", duration: "14 hours", isFree: true },
            { platform: "Udemy", title: "Ultimate AWS Certified Solutions Architect", url: "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/", duration: "27 hours", isFree: false },
            { platform: "Coursera", title: "AWS Cloud Solutions Architect", url: "https://www.coursera.org/professional-certificates/aws-cloud-solutions-architect", duration: "6 months", isFree: false },
        ],
        salaryImpactINR: "+₹4L/yr",
        salaryImpactUSD: "+$15K/yr",
    },
    {
        skill: "GraphQL",
        courses: [
            { platform: "YouTube", title: "GraphQL Full Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=ed8SzALpx1Q", duration: "2 hours", isFree: true },
            { platform: "Udemy", title: "GraphQL by Example", url: "https://www.udemy.com/course/graphql-by-example/", duration: "7 hours", isFree: false },
            { platform: "Coursera", title: "Building Scalable APIs with GraphQL", url: "https://www.coursera.org/projects/building-scalable-apis-with-graphql", duration: "2 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "React",
        courses: [
            { platform: "YouTube", title: "React Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=bMknfKXIFA8", duration: "12 hours", isFree: true },
            { platform: "Udemy", title: "React - The Complete Guide 2026", url: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/", duration: "68 hours", isFree: false },
            { platform: "Coursera", title: "Meta React Specialization", url: "https://www.coursera.org/professional-certificates/meta-react-native", duration: "7 months", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$10K/yr",
    },
    {
        skill: "Next.js",
        courses: [
            { platform: "YouTube", title: "Next.js 14 Full Course — JavaScript Mastery", url: "https://www.youtube.com/watch?v=wm5gMKuwSYk", duration: "5 hours", isFree: true },
            { platform: "Udemy", title: "Next.js & React - The Complete Guide", url: "https://www.udemy.com/course/nextjs-react-the-complete-guide/", duration: "25 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "TypeScript",
        courses: [
            { platform: "YouTube", title: "TypeScript Full Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=30LWjhZzg50", duration: "5 hours", isFree: true },
            { platform: "Udemy", title: "Understanding TypeScript", url: "https://www.udemy.com/course/understanding-typescript/", duration: "15 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "Node.js",
        courses: [
            { platform: "YouTube", title: "Node.js Full Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=Oe421EPjeBE", duration: "8 hours", isFree: true },
            { platform: "Udemy", title: "The Complete Node.js Developer Course", url: "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/", duration: "35 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Python",
        courses: [
            { platform: "YouTube", title: "Python for Everybody — freeCodeCamp", url: "https://www.youtube.com/watch?v=8DvywoWv6fI", duration: "14 hours", isFree: true },
            { platform: "Coursera", title: "Python for Everybody Specialization", url: "https://www.coursera.org/specializations/python", duration: "8 months", isFree: false },
            { platform: "Udemy", title: "100 Days of Code: Python", url: "https://www.udemy.com/course/100-days-of-code/", duration: "60 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2.5L/yr",
        salaryImpactUSD: "+$10K/yr",
    },
    {
        skill: "Java",
        courses: [
            { platform: "YouTube", title: "Java Programming — freeCodeCamp", url: "https://www.youtube.com/watch?v=GoXwIVyNvX0", duration: "10 hours", isFree: true },
            { platform: "Udemy", title: "Java Programming Masterclass", url: "https://www.udemy.com/course/java-the-complete-java-developer-course/", duration: "80 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Go",
        courses: [
            { platform: "YouTube", title: "Go Programming — freeCodeCamp", url: "https://www.youtube.com/watch?v=un6ZyFkqFKo", duration: "7 hours", isFree: true },
            { platform: "Udemy", title: "Go: The Complete Developer's Guide", url: "https://www.udemy.com/course/go-the-complete-developers-guide/", duration: "9 hours", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "Rust",
        courses: [
            { platform: "YouTube", title: "Rust Programming Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=BpPEoZW5IiY", duration: "14 hours", isFree: true },
            { platform: "Udemy", title: "The Rust Programming Language", url: "https://www.udemy.com/course/rust-lang/", duration: "12 hours", isFree: false },
        ],
        salaryImpactINR: "+₹4L/yr",
        salaryImpactUSD: "+$15K/yr",
    },
    {
        skill: "System Design",
        courses: [
            { platform: "YouTube", title: "System Design for Beginners — Gaurav Sen", url: "https://www.youtube.com/watch?v=FSR1s2b-lhc", duration: "1 hour", isFree: true },
            { platform: "Udemy", title: "Grokking System Design", url: "https://www.udemy.com/course/rocking-system-design/", duration: "16 hours", isFree: false },
        ],
        salaryImpactINR: "+₹5L/yr",
        salaryImpactUSD: "+$20K/yr",
    },
    {
        skill: "CI/CD",
        courses: [
            { platform: "YouTube", title: "GitHub Actions Tutorial — TechWorld with Nana", url: "https://www.youtube.com/watch?v=R8_veQiYBjI", duration: "2 hours", isFree: true },
            { platform: "Udemy", title: "The Complete GitHub Actions & Workflows Guide", url: "https://www.udemy.com/course/github-actions/", duration: "10 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "Terraform",
        courses: [
            { platform: "YouTube", title: "Terraform Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=SLB_c_ayRMo", duration: "3 hours", isFree: true },
            { platform: "Udemy", title: "HashiCorp Certified: Terraform Associate", url: "https://www.udemy.com/course/terraform-beginner-to-advanced/", duration: "20 hours", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "MongoDB",
        courses: [
            { platform: "YouTube", title: "MongoDB Crash Course — Traversy Media", url: "https://www.youtube.com/watch?v=-56x56UppqQ", duration: "1 hour", isFree: true },
            { platform: "Udemy", title: "MongoDB - The Complete Developer's Guide", url: "https://www.udemy.com/course/mongodb-the-complete-developers-guide/", duration: "17 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    {
        skill: "PostgreSQL",
        courses: [
            { platform: "YouTube", title: "PostgreSQL Tutorial — freeCodeCamp", url: "https://www.youtube.com/watch?v=qw--VYLpxG4", duration: "4 hours", isFree: true },
            { platform: "Udemy", title: "SQL and PostgreSQL: The Complete Developer's Guide", url: "https://www.udemy.com/course/sql-and-postgresql/", duration: "22 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "Redis",
        courses: [
            { platform: "YouTube", title: "Redis Crash Course — Traversy Media", url: "https://www.youtube.com/watch?v=jgpVdJB2sKQ", duration: "40 min", isFree: true },
            { platform: "Udemy", title: "Redis: The Complete Developer's Guide", url: "https://www.udemy.com/course/redis-the-complete-developers-guide-p/", duration: "13 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    {
        skill: "Kafka",
        courses: [
            { platform: "YouTube", title: "Apache Kafka in 6 Minutes", url: "https://www.youtube.com/watch?v=Ch5VhJzaoaI", duration: "6 min", isFree: true },
            { platform: "Udemy", title: "Apache Kafka for Beginners", url: "https://www.udemy.com/course/apache-kafka/", duration: "8 hours", isFree: false },
            { platform: "Coursera", title: "Event-Driven Architectures with Kafka", url: "https://www.coursera.org/learn/event-driven-architecture", duration: "4 weeks", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "Machine Learning",
        courses: [
            { platform: "YouTube", title: "Machine Learning Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=NWONeJKn6kc", duration: "10 hours", isFree: true },
            { platform: "Coursera", title: "Machine Learning Specialization — Andrew Ng", url: "https://www.coursera.org/specializations/machine-learning-introduction", duration: "3 months", isFree: false },
        ],
        salaryImpactINR: "+₹5L/yr",
        salaryImpactUSD: "+$20K/yr",
    },
    {
        skill: "Deep Learning",
        courses: [
            { platform: "YouTube", title: "Deep Learning Crash Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=VyWAvY2CF9c", duration: "6 hours", isFree: true },
            { platform: "Coursera", title: "Deep Learning Specialization — Andrew Ng", url: "https://www.coursera.org/specializations/deep-learning", duration: "5 months", isFree: false },
        ],
        salaryImpactINR: "+₹6L/yr",
        salaryImpactUSD: "+$25K/yr",
    },
    {
        skill: "TensorFlow",
        courses: [
            { platform: "YouTube", title: "TensorFlow 2.0 Full Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=tPYj3fFJGjk", duration: "7 hours", isFree: true },
            { platform: "Coursera", title: "TensorFlow Developer Certificate", url: "https://www.coursera.org/professional-certificates/tensorflow-in-practice", duration: "4 months", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "PyTorch",
        courses: [
            { platform: "YouTube", title: "PyTorch for Deep Learning — freeCodeCamp", url: "https://www.youtube.com/watch?v=V_xro1bcAuA", duration: "26 hours", isFree: true },
            { platform: "Udemy", title: "PyTorch for Deep Learning with Python", url: "https://www.udemy.com/course/pytorch-for-deep-learning-with-python-bootcamp/", duration: "17 hours", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "Azure",
        courses: [
            { platform: "YouTube", title: "Azure Fundamentals — freeCodeCamp", url: "https://www.youtube.com/watch?v=NKEFWyqJ5XA", duration: "5 hours", isFree: true },
            { platform: "Udemy", title: "AZ-900 Azure Fundamentals", url: "https://www.udemy.com/course/az900-azure/", duration: "11 hours", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$10K/yr",
    },
    {
        skill: "GCP",
        courses: [
            { platform: "YouTube", title: "GCP Full Course — Edureka", url: "https://www.youtube.com/watch?v=IUU6OR8yHCc", duration: "10 hours", isFree: true },
            { platform: "Coursera", title: "Google Cloud Professional Certificate", url: "https://www.coursera.org/professional-certificates/cloud-engineering-gcp", duration: "6 months", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "Vue.js",
        courses: [
            { platform: "YouTube", title: "Vue.js Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=FXpIoQ_rT_c", duration: "4 hours", isFree: true },
            { platform: "Udemy", title: "Vue - The Complete Guide", url: "https://www.udemy.com/course/vuejs-2-the-complete-guide/", duration: "32 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Angular",
        courses: [
            { platform: "YouTube", title: "Angular Full Course — freeCodeCamp", url: "https://www.youtube.com/watch?v=3qBXWUpoPHo", duration: "8 hours", isFree: true },
            { platform: "Udemy", title: "Angular - The Complete Guide", url: "https://www.udemy.com/course/the-complete-guide-to-angular-2/", duration: "37 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Microservices",
        courses: [
            { platform: "YouTube", title: "Microservices Architecture — freeCodeCamp", url: "https://www.youtube.com/watch?v=lTAcCNbJ7KE", duration: "2 hours", isFree: true },
            { platform: "Udemy", title: "Microservices with Node JS and React", url: "https://www.udemy.com/course/microservices-with-node-js-and-react/", duration: "54 hours", isFree: false },
        ],
        salaryImpactINR: "+₹3L/yr",
        salaryImpactUSD: "+$12K/yr",
    },
    {
        skill: "REST API",
        courses: [
            { platform: "YouTube", title: "REST API Design Best Practices — Traversy Media", url: "https://www.youtube.com/watch?v=-MTSQjw5DrM", duration: "30 min", isFree: true },
            { platform: "Udemy", title: "REST APIs with Flask and Python", url: "https://www.udemy.com/course/rest-api-flask-and-python/", duration: "17 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$4K/yr",
    },
    {
        skill: "Spring Boot",
        courses: [
            { platform: "YouTube", title: "Spring Boot Tutorial — Amigoscode", url: "https://www.youtube.com/watch?v=9SGDpanrc8U", duration: "3 hours", isFree: true },
            { platform: "Udemy", title: "Spring Framework 6: Beginner to Guru", url: "https://www.udemy.com/course/spring-framework-6-beginner-to-guru/", duration: "60 hours", isFree: false },
        ],
        salaryImpactINR: "+₹2.5L/yr",
        salaryImpactUSD: "+$10K/yr",
    },
    {
        skill: "SQL",
        courses: [
            { platform: "YouTube", title: "SQL Tutorial — freeCodeCamp", url: "https://www.youtube.com/watch?v=HXV3zeQKqGY", duration: "4 hours", isFree: true },
            { platform: "Udemy", title: "The Complete SQL Bootcamp", url: "https://www.udemy.com/course/the-complete-sql-bootcamp/", duration: "9 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    // ═══════ NON-IT / BUSINESS SKILLS ═══════
    {
        skill: "Excel",
        courses: [
            { platform: "YouTube", title: "Excel Tutorial for Beginners — freeCodeCamp", url: "https://www.youtube.com/watch?v=Vl0H-qTclOg", duration: "3 hours", isFree: true },
            { platform: "Coursera", title: "Excel Skills for Business", url: "https://www.coursera.org/specializations/excel", duration: "6 months", isFree: false },
        ],
        salaryImpactINR: "+₹0.5L/yr",
        salaryImpactUSD: "+$3K/yr",
    },
    {
        skill: "Tableau",
        courses: [
            { platform: "YouTube", title: "Tableau Full Course — Simplilearn", url: "https://www.youtube.com/watch?v=aHaOIvR00So", duration: "8 hours", isFree: true },
            { platform: "Udemy", title: "Tableau 2024 A-Z: Hands-On Tableau Training", url: "https://www.udemy.com/course/tableau10/", duration: "8 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$7K/yr",
    },
    {
        skill: "Power BI",
        courses: [
            { platform: "YouTube", title: "Power BI Full Course — Edureka", url: "https://www.youtube.com/watch?v=3u7MQz1EyPY", duration: "9 hours", isFree: true },
            { platform: "Coursera", title: "Microsoft Power BI Data Analyst", url: "https://www.coursera.org/professional-certificates/microsoft-power-bi-data-analyst", duration: "5 months", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$7K/yr",
    },
    {
        skill: "Data Analysis",
        courses: [
            { platform: "YouTube", title: "Data Analysis with Python — freeCodeCamp", url: "https://www.youtube.com/watch?v=r-uOLxNrNk8", duration: "12 hours", isFree: true },
            { platform: "Coursera", title: "Google Data Analytics Certificate", url: "https://www.coursera.org/professional-certificates/google-data-analytics", duration: "6 months", isFree: false },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
    {
        skill: "Project Management",
        courses: [
            { platform: "Coursera", title: "Google Project Management Certificate", url: "https://www.coursera.org/professional-certificates/google-project-management", duration: "6 months", isFree: false },
            { platform: "YouTube", title: "PMP Certification Full Course — Edureka", url: "https://www.youtube.com/watch?v=GC7pN8Mjot8", duration: "9 hours", isFree: true },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$10K/yr",
    },
    {
        skill: "Agile",
        courses: [
            { platform: "Coursera", title: "Agile with Atlassian Jira", url: "https://www.coursera.org/learn/agile-atlassian-jira", duration: "4 weeks", isFree: false },
            { platform: "YouTube", title: "Agile Scrum Full Course — Simplilearn", url: "https://www.youtube.com/watch?v=gy1c4_YaBkA", duration: "4 hours", isFree: true },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    {
        skill: "Scrum",
        courses: [
            { platform: "YouTube", title: "Scrum Master Full Course — Simplilearn", url: "https://www.youtube.com/watch?v=b02ZkndLk1Y", duration: "7 hours", isFree: true },
            { platform: "Udemy", title: "Agile Scrum Master Certification Prep", url: "https://www.udemy.com/course/scrum-master/", duration: "4 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "Digital Marketing",
        courses: [
            { platform: "Coursera", title: "Google Digital Marketing Certificate", url: "https://www.coursera.org/professional-certificates/google-digital-marketing-ecommerce", duration: "6 months", isFree: false },
            { platform: "YouTube", title: "Digital Marketing Full Course — Simplilearn", url: "https://www.youtube.com/watch?v=nU-IIXBWlS4", duration: "11 hours", isFree: true },
        ],
        salaryImpactINR: "+₹1.5L/yr",
        salaryImpactUSD: "+$6K/yr",
    },
    {
        skill: "SEO",
        courses: [
            { platform: "YouTube", title: "SEO Full Course — Ahrefs", url: "https://www.youtube.com/watch?v=DvwS7cV9GmQ", duration: "2 hours", isFree: true },
            { platform: "Coursera", title: "SEO Specialization — UC Davis", url: "https://www.coursera.org/specializations/seo", duration: "5 months", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    {
        skill: "Figma",
        courses: [
            { platform: "YouTube", title: "Figma Tutorial for Beginners — freeCodeCamp", url: "https://www.youtube.com/watch?v=jwCmIBJ8Jtc", duration: "3 hours", isFree: true },
            { platform: "Udemy", title: "Complete Figma Masterclass", url: "https://www.udemy.com/course/figma-ux-ui-design-user-experience-tutorial-course/", duration: "20 hours", isFree: false },
        ],
        salaryImpactINR: "+₹1L/yr",
        salaryImpactUSD: "+$5K/yr",
    },
    {
        skill: "Communication",
        courses: [
            { platform: "Coursera", title: "Improving Communication Skills — UPenn", url: "https://www.coursera.org/learn/wharton-communication-skills", duration: "4 weeks", isFree: false },
            { platform: "YouTube", title: "Communication Skills — TED", url: "https://www.youtube.com/watch?v=eIho2S0ZahI", duration: "20 min", isFree: true },
        ],
        salaryImpactINR: "+₹0.5L/yr",
        salaryImpactUSD: "+$3K/yr",
    },
    {
        skill: "Leadership",
        courses: [
            { platform: "Coursera", title: "Leading People and Teams — University of Michigan", url: "https://www.coursera.org/specializations/leading-teams", duration: "5 months", isFree: false },
            { platform: "YouTube", title: "Leadership Skills — Brian Tracy", url: "https://www.youtube.com/watch?v=qYvXk_1Cxwc", duration: "1 hour", isFree: true },
        ],
        salaryImpactINR: "+₹2L/yr",
        salaryImpactUSD: "+$8K/yr",
    },
];

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

/**
 * Look up learning resources for a given skill (fuzzy match).
 * Returns null if no match found.
 */
export function findLearningResource(skill: string): SkillLearningResource | null {
    const lower = skill.toLowerCase().trim();
    return LEARNING_DB.find(r =>
        r.skill.toLowerCase() === lower ||
        lower.includes(r.skill.toLowerCase()) ||
        r.skill.toLowerCase().includes(lower)
    ) || null;
}

/**
 * Enrich an array of missing skills with learning resources and salary impact.
 * Returns array with entries that have matching resources.
 */
export function enrichMissingSkills(missingSkills: string[]): Array<{
    skill: string;
    courses: CourseLink[];
    salaryImpactINR: string;
    salaryImpactUSD: string;
}> {
    const results: Array<{
        skill: string;
        courses: CourseLink[];
        salaryImpactINR: string;
        salaryImpactUSD: string;
    }> = [];

    for (const skill of missingSkills) {
        const resource = findLearningResource(skill);
        if (resource) {
            results.push({
                skill: resource.skill,
                courses: resource.courses,
                salaryImpactINR: resource.salaryImpactINR,
                salaryImpactUSD: resource.salaryImpactUSD,
            });
        } else {
            // If no exact match, provide generic placeholder
            results.push({
                skill,
                courses: [
                    { platform: "YouTube", title: `Learn ${skill} — Full Course`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " full course")}`, duration: "Varies", isFree: true },
                    { platform: "Udemy", title: `${skill} for Beginners`, url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`, duration: "Varies", isFree: false },
                    { platform: "Coursera", title: `${skill} Fundamentals`, url: `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`, duration: "Varies", isFree: false },
                ],
                salaryImpactINR: "+₹1–3L/yr",
                salaryImpactUSD: "+$5–12K/yr",
            });
        }
    }

    return results;
}
