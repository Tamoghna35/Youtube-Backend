import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok"
    // })


    // taking the required field rom user
    const { username, email, fullName, password } = req.body

    // Empty fields validation
    if ([username, email, fullName, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    // checking for alrady existed users
    const existedUser = User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User is already existed")
    }

    // Check avater and cover image is upload correctly or not

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // upload image and avatar in Cloudinary
    const avatar = await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)

    // Check avatar is actually upload in the cloudinary or not

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    // create user in db
   const user = await User.create({
        username: username.toLowerCase(),
        password,
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
        
        
   })
    
    // check user is actually created in db or not if created reemove pasword and refrshToken from responsbody

    const createUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createUser) {
        throw new ApiError(500, "Something went wrong while creating the user")
    }
    // Finally return the response in the formatted way

    return res.status(200).json(
        new ApiResponse(200, createUser,"User Registered successfully")
    )
})

export { registerUser }