import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import jwt from "jsonwebtoken"

const generateAccessTokenandRefreshToken = async (userId) => {
    try {
        console.log("UserId ==>", userId);
        const user = await User.findById(userId)
        console.log("user==>", user);
        const accessToken = user.generateAccessToken()
        console.log("Access Token ==>", accessToken);
        const refreshToken = user.generateRefreshToken()
        console.log("Refresh Token ==>", refreshToken);
        
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access Token and refresh Token")
    }
}
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
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User is already existed")
    }

    // Check avater and cover image is upload correctly or not
    console.log("req.files ===>", req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // console.log("avatarLocalPath===>", avatarLocalPath);
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    console.log("coverImageLocalPath===>", coverImageLocalPath);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // upload image and avatar in Cloudinary
    const avatar = await uploadCloudinary(avatarLocalPath)
    console.log("Avatar===>", avatar);
    const coverImage = await uploadCloudinary(coverImageLocalPath)
    console.log("coverImage===>", coverImage);
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
        new ApiResponse(200, createUser, "User Registered successfully")
    )
})

const logInUser = asyncHandler(async (req, res) => {
    // Take data from request body
    console.log('Request Body:', req.body);
    const { username, email, password } = req.body;

    // check if any fiels is empty or not
    if (!username && !email) {
        throw new ApiError(400, "UserName or Elementmail is required")
    }

    // if username or email is fetched correcly check any user with thw same credential is present or not in DB
    const user = await User.findOne({ $or: [{ username }, { email }] })

    if (!user) {
        throw new ApiError(400, "User is not registered")
    }
    // Log the password before calling the comparison function
    console.log('Password from Request:', password);


    // check the password and compair
    const isPasswordValid = await user.isPasswordCorrect(password)

   

    if (!isPasswordValid) {
        throw new ApiError(401, "Password is not valid")
    }

    const { accessToken, refreshToken } = await generateAccessTokenandRefreshToken(user._id)
    

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")


    // sent cookies

    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged In successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id
        , {
            $set: {
                refreshToken: undefined
            }
        }, {
        new: true
    })
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))
})

const generateNewAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthoried Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKRN_EXPIRY)
        console.log("Decoded Token ===>", decodedToken);
        
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401,"Refresh Token is expired or used" )
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { newlyGeneratedAccessToken, newlyGeneratedRefreshToken } = await generateAccessTokenandRefreshToken(user._id)
    
        return res
            .status(200)
            .cookie("accessToken", newlyGeneratedAccessToken, options)
            .cookie("refreshToken", newlyGeneratedRefreshToken, options)
            .json(
                200,
                { accessToken: newlyGeneratedAccessToken, refreshToken: newlyGeneratedRefreshToken },
                "Access Token Refreshed"
        )
    } catch (error) {
        throw new ApiError(401, error?.message||"Invalid refresh Token")
    }

})

const changeCurrentUserPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400,"Invalid Password")
    }
    user.password = newPassword
    await user.save({ validateBeforeSave: false })
    
    return res.status(200)
    .json(new ApiResponse(200, {},"Password change successfully"))

    
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json( new ApiResponse( 200, req.user, "User details fetched successfully"))
})

const updateUser = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, "Both the fields are requird")
    }
    const user = User.findByIdAndDelete(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
    .json(new ApiResponse(200, user,"Data updated Succesfully"))
})

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?._id
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avater file is not available")
    }
    const avatar = await uploadCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading the file")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            avatar: avatar.url
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "Avatar is updated Successfully"))
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImagelocalPath = req.file?._id

    if (!coverImagelocalPath) {
        throw new ApiError(400, "CoverImage not found")
    }
    const coverImage = await uploadCloudinary(coverImagelocalPath)
    if (!coverImage.url) {
        throw new ApiError(400,"CoverImage url is not present")
    }
   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage:coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "CoverImage upload successfully"))
})

export {
    registerUser,
    logInUser,
    logoutUser,
    generateNewAccessToken,
    changeCurrentUserPassword,
    getCurrentUser,
    updateUser,
    updateAvatar,
    updateCoverImage
}