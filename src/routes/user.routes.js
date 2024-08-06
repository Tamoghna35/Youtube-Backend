import { Router } from "express";
import { generateNewAccessToken, logInUser, logoutUser, registerUser } from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields(
        [
            {
                name: "avatar",
                maxCount: 1
            },
            {
                name: "coverImage",
                maxCount: 1
            }
        ]
    ),
    registerUser
)

router.route("/login").post(logInUser)

router.route("/logout").post(verifyJWT, logoutUser)
router.route("/secure-token").post(generateNewAccessToken)

export default router;