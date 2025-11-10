require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("./swagger");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

const app = express();
app.use(express.json());
app.use(cors());
app.use("/swag", swaggerUi.serve, swaggerUi.setup(swaggerJsDoc));

async function createTransporter() {
  try {
    // Get email credentials from environment variables
    const email = process.env.EMAIL_USER;
    const password = process.env.EMAIL_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "Email credentials are not properly configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: email,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify the transporter configuration
    await transporter.verify();
    console.log("SMTP connection verified successfully");
    return transporter;
  } catch (error) {
    console.error("Failed to create transporter:", error.message);
    throw error; // Rethrow the error so you can catch it where createTransporter is called
  }
}

const filePath = path.join(__dirname, "template.html");
const source = fs.readFileSync(filePath, "utf8");
const template = handlebars.compile(source);

// Load and compile the form submission template
const formSubmissionFilePath = path.join(
  __dirname,
  "form-submission-template.html"
);
const formSubmissionSource = fs.readFileSync(formSubmissionFilePath, "utf8");
const formSubmissionTemplate = handlebars.compile(formSubmissionSource);

// Load and compile the after demo template
const afterDemoFilePath = path.join(__dirname, "after-demo-template.html");
const afterDemoSource = fs.readFileSync(afterDemoFilePath, "utf8");
const afterDemoTemplate = handlebars.compile(afterDemoSource);

// Load and compile the after demo confirmation template
const afterDemoConfirmationFilePath = path.join(
  __dirname,
  "after-demo-confirmation-template.html"
);
const afterDemoConfirmationSource = fs.readFileSync(
  afterDemoConfirmationFilePath,
  "utf8"
);
const afterDemoConfirmationTemplate = handlebars.compile(
  afterDemoConfirmationSource
);

// Load and compile the demo confirmation template
const demoConfirmationFilePath = path.join(
  __dirname,
  "demo-confirmation-template.html"
);
const demoConfirmationSource = fs.readFileSync(
  demoConfirmationFilePath,
  "utf8"
);
const demoConfirmationTemplate = handlebars.compile(demoConfirmationSource);

/**
 * @swagger
 * /send-email:
 *  post:
 *    summary: Send an email to a specified recipient
 *    description: Send an email using the configured SMTP server.
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - recipient
 *              - name
 *            properties:
 *              recipient:
 *                type: string
 *                description: Email address of the recipient
 *    responses:
 *      200:
 *        description: Email sent successfully
 *      500:
 *        description: Error in sending email
 */
app.post("/send-email", async (req, res) => {
  const { recipient, name } = req.body;
  const htmlToSend = template({});

  try {
    const transporter = await createTransporter();
    const mailOptions = {
      from: '"Train App" <info@trainapp.org>',
      to: recipient,
      subject: "Welcome to Train App!",
      html: htmlToSend,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).json({ error: "Error sending email" });
  }
});

/**
 * @swagger
 * /submit-form:
 *  post:
 *    summary: Submit a demo form and send notification email
 *    description: Receive form submission data and send a formatted email notification.
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - name
 *              - email
 *              - role
 *            properties:
 *              name:
 *                type: string
 *                description: Name of the person submitting the form
 *              email:
 *                type: string
 *                description: Email address of the person submitting the form
 *              role:
 *                type: string
 *                description: Role of the person submitting the form
 *              used_program:
 *                type: string
 *                description: Whether the person has used the program before
 *              program_format:
 *                type: string
 *                description: Preferred program format
 *    responses:
 *      200:
 *        description: Form submission received and email sent successfully
 *      400:
 *        description: Missing required fields
 *      500:
 *        description: Error processing form submission
 */
app.post("/submit-form", async (req, res) => {
  const { name, email, role, used_program, program_format } = req.body;

  // Validate required fields
  if (!name || !email || !role) {
    return res.status(400).json({
      error: "Missing required fields: name, email, and role are required",
    });
  }

  try {
    // Format current date for the email
    const submissionDate = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Prepare email content with form data
    const htmlToSend = formSubmissionTemplate({
      name,
      email,
      role,
      used_program: used_program || "Not specified",
      program_format: program_format || "Not specified",
      submission_date: submissionDate,
    });

    const transporter = await createTransporter();
    const mailOptions = {
      from: '"Train App Form" <info@trainapp.org>',
      to: "trainapp9@gmail.com", // Send to the specified email
      subject: `New Demo Form Submission from ${name}`,
      html: htmlToSend,
      replyTo: email, // Set reply-to as the submitter's email
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Form submission email sent: " + info.response);

    // Also send a confirmation email to the submitter with demo link
    const demoUrl = process.env.DEMO_URL || "https://demo.trainapp.io";

    const confirmationHtml = demoConfirmationTemplate({
      name,
      demoUrl,
    });

    const confirmationMailOptions = {
      from: '"Train App" <info@trainapp.org>',
      to: email,
      subject: "Welcome to Train App - Start Your Demo! 🚀",
      html: confirmationHtml,
    };

    await transporter.sendMail(confirmationMailOptions);
    console.log("Demo confirmation email sent to: " + email);

    res
      .status(200)
      .json({ message: "Form submission received and processed successfully" });
  } catch (error) {
    console.error("Error processing form submission:", error.message);
    res.status(500).json({ error: "Error processing form submission" });
  }
});

app.post("/after-demo-form", async (req, res) => {
  const { name, email, difficulty, feedback } = req.body;

  // Validate required fields
  if (!name || !email || !difficulty || !feedback) {
    return res.status(400).json({
      error:
        "Missing required fields: name, email, difficulty, and feedback are required",
    });
  }

  try {
    // Format current date for the email
    const submissionDate = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Determine difficulty level and color class
    let difficultyClass = "";
    let difficultyLabel = "";

    if (difficulty <= 3) {
      difficultyClass = "difficulty-easy";
      difficultyLabel = "Very Easy";
    } else if (difficulty <= 5) {
      difficultyClass = "difficulty-easy";
      difficultyLabel = "Easy";
    } else if (difficulty <= 7) {
      difficultyClass = "difficulty-medium";
      difficultyLabel = "Moderate";
    } else if (difficulty <= 8) {
      difficultyClass = "difficulty-medium";
      difficultyLabel = "Challenging";
    } else {
      difficultyClass = "difficulty-hard";
      difficultyLabel = "Very Difficult";
    }

    // Prepare email content with form data using the after-demo template
    const htmlToSend = afterDemoTemplate({
      name,
      email,
      difficulty,
      difficulty_class: difficultyClass,
      difficulty_label: difficultyLabel,
      feedback,
      submission_date: submissionDate,
    });

    const transporter = await createTransporter();
    const mailOptions = {
      from: '"Train App Feedback" <info@trainapp.org>',
      to: "trainapp9@gmail.com", // Send to the specified email
      subject: `Demo Feedback from ${name}`,
      html: htmlToSend,
      replyTo: email, // Set reply-to as the submitter's email
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("After demo feedback email sent: " + info.response);

    // Send a confirmation email to the submitter using the after-demo confirmation template
    const confirmationHtml = afterDemoConfirmationTemplate({
      name,
      email,
    });

    const confirmationMailOptions = {
      from: '"Train App" <info@trainapp.org>',
      to: email,
      subject: "Thank you for your feedback!",
      html: confirmationHtml,
    };

    await transporter.sendMail(confirmationMailOptions);

    res.status(200).json({
      message: "After demo feedback received and processed successfully",
    });
  } catch (error) {
    console.error("Error processing after demo feedback:", error.message);
    res.status(500).json({ error: "Error processing after demo feedback" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
