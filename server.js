const express = require("express");
const userData = require("./MOCK_DATA.json");
const graphql = require("graphql")
const { PDFDocument } = require("pdf-lib");
const app = express();
require('dotenv').config()
const { GraphQLObjectType, GraphQLSchema, GraphQLList, GraphQLID, GraphQLInt, GraphQLString } = graphql
const { graphqlHTTP } = require("express-graphql")
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
console.log(process.env.PORT);
const PORT = process.env.PORT || 5000;
const UserType = new GraphQLObjectType({
    name: "User",
    fields: () => ({
        id: { type: GraphQLInt },
        firstName: { type: GraphQLString },
        lastName: { type: GraphQLString },
        email: { type: GraphQLString },
        password: { type: GraphQLString },
    })
})

const RootQuery = new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
        getAllUsers: {
            type: new GraphQLList(UserType),
            args: { id: {type: GraphQLInt}},
            resolve(parent, args) {
                return userData;
            }
        },
        findUserById: {
            type: UserType,
            description: "fetch single user",
            args: { id: {type: GraphQLInt}},
            resolve(parent, args) {
                return userData.find((a) => a.id == args.id);
            }
        }
    }
})
const Mutation = new GraphQLObjectType({
    name: "Mutation",
    fields: {
        createUser: {
            type: UserType,
            args: {
                firstName: {type: GraphQLString},
                lastName: { type: GraphQLString },
                email: { type: GraphQLString },
                password: { type: GraphQLString },
            },
            resolve(parent, args) {
                userData.push({
                    id: userData.length + 1,
                    firstName: args.firstName,
                    lastName: args.lastName,
                    email: args.email,
                    password: args.password
                })
                return args
            }
        }
    }
})

const schema = new GraphQLSchema({query: RootQuery, mutation: Mutation})
app.use("/graphql", graphqlHTTP({
    schema,
    graphiql: true,
  })
);

app.get("/getUsersData", (req, res) => {
  res.json({ ok: true, users: [
    {
      "id": 1,
      "firstName": "Phineas",
      "lastName": "Franciottoi",
      "email": "pfranciottoi0@hostgator.com",
      "password": "y0pWrGzmDz"
    },
    {
      "id": 2,
      "firstName": "Mikel",
      "lastName": "Gregoli",
      "email": "mgregoli1@amazon.de",
      "password": "G0VfMCL"
    },
    {
      "id": 3,
      "firstName": "Moira",
      "lastName": "Mazzilli",
      "email": "mmazzilli2@163.com",
      "password": "3GgdWoOfT"
    }
  ]});
});

async function mergePDFsFromBase64(base64Array) {
    console.log("Merging PDFs...", base64Array);
  if (!Array.isArray(base64Array) || base64Array.length === 0) {
    throw new Error("No PDF data provided to merge.");
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < base64Array.length; i++) {
    let base64Str = base64Array[i];

    if (!base64Str || typeof base64Str !== "string") {
      throw new Error(`Invalid PDF data at index ${i}: Expected a string.`);
    }

    // 🧹 Remove data URI prefix if present
    if (base64Str.startsWith("data:application/pdf;base64,")) {
      base64Str = base64Str.replace("data:application/pdf;base64,", "");
    }

    // Trim whitespace
    base64Str = base64Str.trim();

    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Str)) {
      throw new Error(`Invalid base64 format at index ${i}`);
    }

    try {
      // Convert Base64 → Uint8Array
      const pdfBytes = Buffer.from(base64Str, "base64");

      if (pdfBytes.length === 0) {
        throw new Error(`Empty PDF data at index ${i}`);
      }

      console.log(`PDF ${i}: Base64 length=${base64Str.length}, Buffer length=${pdfBytes.length}, First 20 bytes:`, pdfBytes.slice(0, 20));

      // Validate PDF header
      const header = pdfBytes.toString("ascii", 0, Math.min(4, pdfBytes.length));
      console.log(`PDF ${i}: Header = "${header}"`);
      
      if (!header.startsWith("%PDF")) {
        throw new Error(`Invalid PDF header at index ${i}. Got "${header}" instead of "%PDF". Make sure the base64 data is a valid PDF.`);
      }

      // Load PDF
      console.log(`PDF ${i}: Attempting to load PDF...`);
      const loadedPdf = await PDFDocument.load(pdfBytes);
      console.log(`PDF ${i}: Successfully loaded. Pages: ${loadedPdf.getPageCount()}`);

      // Copy pages
      const copiedPages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      console.log(`PDF ${i}: Added ${copiedPages.length} pages to merged document`);
    } catch (error) {
      console.error(`PDF ${i} Debug - Base64 sample (first 100 chars):`, base64Str.substring(0, 100));
      throw new Error(`Failed to process PDF at index ${i}: ${error.message}`);
    }
  }

  // Save merged PDF
  const mergedPdfBytes = await mergedPdf.save();

  return Buffer.from(mergedPdfBytes);
}


app.post("/api/merge-pdf", async (req, res) => {
    console.log("Merge Started");
  try {
    const { pdfArray } = req.body;

    if (!Array.isArray(pdfArray) || pdfArray.length === 0) {
      return res.status(400).json({ error: "pdfArray must be a non-empty array of base64 PDFs." });
    }

    const mergedBuffer = await mergePDFsFromBase64(pdfArray);

    // Convert buffer to base64
    const base64Pdf = mergedBuffer.toString("base64");
    const base64Path = `data:application/pdf;base64,${base64Pdf}`;

    res.status(200).json({
      status: "success",
      message: "Merged PDF created successfully.",
      pdfBase64Path: base64Path,
    });

    console.log("Merge Ended, returned PDF base64");
  } catch (error) {
    console.error("❌ Error merging PDFs:", error);
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});